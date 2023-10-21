// Helpers and stuff
const pieces = [
	{
		name: 'I',
		color: '#22b8cf',
		blocks: [
			[ 0, 0, 0, 0 ],
			[ 1, 1, 1, 1 ],
			[ 0, 0, 0, 0 ],
			[ 0, 0, 0, 0 ]
		]
	},
	{
		name: 'J',
		color: '#5c7cfa',
		blocks: [
			[ 1, 0, 0 ],
			[ 1, 1, 1 ],
			[ 0, 0, 0]
		]
	},
	{
		name: 'L',
		color: '#ff922b',
		blocks: [
			[ 0, 0, 1 ],
			[ 1, 1, 1 ],
			[ 0, 0, 0]
		]
	},
	{
		name: 'O',
		color: '#ffd43b',
		blocks: [
			[ 1, 1 ],
			[ 1, 1 ]
		]
	},
	{
		name: 'S',
		color: '#51cf66',
		blocks: [
			[ 0, 1, 1 ],
			[ 1, 1, 0 ],
			[ 0, 0, 0 ]
		]
	},
	{
		name: 'T',
		color: '#cc5de8',
		blocks: [
			[ 0, 1, 0 ],
			[ 1, 1, 1 ],
			[ 0, 0, 0 ]
		]
	},
	{
		name: 'Z',
		color: '#ff6b6b',
		blocks: [
			[ 1, 1, 0 ],
			[ 0, 1, 1 ],
			[ 0, 0, 0 ]
		]
	}
]

const vFramesPerLevel = [
	48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2
]

const allKeys1 = [ 'w', 'a', 's', 'd', 'c' ]

const b2p = 24
const boardWidthB = 14
const boardHeightB = 26
const previewMarginB = 2
const previewMarginVB = 0.7
const previewSizeB = 4

const lateralTime = 70
const maxSoftDropTime = 24
const lockTime = 500
const shakeTime = 300
const flickerTimeBase = 500

const lockSound = new Audio('sounds/bwong.mp3')
const movementSound = new Audio('sounds/wow.mp3')
const rotateSound = new Audio('sounds/squeak.mp3')
const collapseSound = new Audio('sounds/whoosh.mp3')
const holdSound = new Audio('sounds/beep.mp3')
const levelSound = new Audio('sounds/toot.mp3')

lockSound.volume = 0.5

function getMinLeft(blocks) {
	return Math.min(...blocks.map((items) => Math.min(
		...items
			.map((item, i) => [ item, i ])
			.filter(([ item ]) => item)
			.map(([, i ]) => i)
	)))
}

function getMaxLeft(blocks) {
	return Math.max(...blocks.map((items) => Math.max(
		...items
			.map((item, i) => [ item, i + 1 ])
			.filter(([ item ]) => item)
			.map(([, i ]) => i)
	)))
}

function getMaxTop(blocks) {
	for (let row = blocks.length - 1; row >= 0; row--) {
		const sum = blocks[row].reduce((p, c) => p + c, 0)
		if (sum !== 0) return row + 1
	}
	return 0
}

function collidesOrBreaks(a, row, col, b) {
	if (getMinLeft(a) + col < 0) return true
	if (getMaxLeft(a) + col > b[0].length) return true
	if (getMaxTop(a) + row > b.length) return true

	for (let row2 = 0; row2 < a.length; row2++) { 
		for (let col2 = 0; col2 < a[0].length; col2++) {
			if (a[row2] && b[row2 + row] && a[row2][col2] && b[row2 + row][col2 + col]) {
				return true
			}
		}
	}
}

function makeQueue() {
	let currentIndex = pieces.length
	const queue = [ ...pieces ]
	
	while (0 !== currentIndex) {
		const randomIndex = Math.floor(Math.random() * currentIndex)
		currentIndex--

		const temp = queue[currentIndex]
		queue[currentIndex] = queue[randomIndex]
		queue[randomIndex] = temp
	}
	
	return queue
}

function prettyPrint(blocks) {
	console.log(blocks.map((row) => row.map((item) => item ? 'X' : '.').join('')).join('\n'))
}

function rotateBlocks(blocks) {
	const newBlocks = []

	for (let col = 0; col < blocks[0].length; col++) {
		newBlocks[col] = []
		for (let row = 0; row < blocks.length; row++) {
			newBlocks[col][blocks.length - row - 1] = blocks[row][col]
		}
	}

	return newBlocks
}

// Game data
const blocks = []

let queue1 = makeQueue()
let current1 = { row: -1, ...queue1.shift() }
let startLock1
let hold1
let swapped1 = false
current1.col = Math.floor(Math.random() * (boardWidthB - current1.blocks[0].length))

let queue2 = makeQueue()
let current2 = { row: -1, ...queue2.shift() }
let startLock2
let hold2
let swapped2 = false
current2.col = Math.floor(Math.random() * (boardWidthB - current2.blocks[0].length))

// Initialize things
for (let row = 0; row < boardHeightB; row++) {
	blocks[row] = new Array(boardWidthB).fill(null)
}

// All the main logic
function setup() {
	createCanvas((boardWidthB + (previewMarginB * 2) + (previewSizeB * 2)) * b2p, boardHeightB * b2p)
}

const keys1 = []
const keys2 = []
let lastKeys1 = keys1
let lastKeys2 = keys2
let lastDateNow = 0

let shakeCount = 0
let flickerCount = 0

let score = 0
let level = 0
let collapsedRowsSinceLevel = 0
let startTime = -1

function swapSidesIfNeeded() {
	if (current1.col > current2.col) {
		const [ queue2o, current2o, startLock2o ] = [ queue2, current2, startLock2 ]

		queue2 = queue1
		current2 = current1
		startLock2 = startLock1

		queue1 = queue2o
		current1 = current2o
		startLock1 = startLock2o
	}
}
swapSidesIfNeeded()

function testDrop(current) {
	const ghost = { ...current }
	while (!collidesOrBreaks(ghost.blocks, ghost.row + 1, ghost.col, blocks)) {
		ghost.row++
	}
	return ghost
}

function lightenHex(hex, amount) {
	const [ r, g, b ] = hex.slice(1).match(/.{1,2}/g).map((item) => parseInt(item, 16))
	const [ nr, ng, nb ] = [
		Math.min(Math.max(r + amount, 0), 255),
		Math.min(Math.max(g + amount, 0), 255),
		Math.min(Math.max(b + amount, 0), 255)
	]
	return '#' + (nb | (ng << 8) | (nr << 16)).toString(16).padStart(6, '0')
}

function drawBlock(row, col, color) {
	fill(color)
	strokeWeight(1)
	stroke(lightenHex(color, -20))
	square(col * b2p, row * b2p, b2p)
	noStroke()
	fill(lightenHex(color, 40))
	square(col * b2p + 2, (row + 1) * b2p - 4, 3)
}

function cleanup() {
	lastDateNow = Date.now()
	lastKeys1 = [ ...keys1 ]
	lastKeys2 = [ ...keys2 ]

	if (queue1.length < pieces.length) queue1 = queue1.concat(makeQueue())
	if (queue2.length < pieces.length) queue2 = queue2.concat(makeQueue())
}

function msToTime(ms) {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return minutes + ':' + seconds.padStart(2, '0')
}

let gameStarted = false
function draw() {
	// Render base elements
	background(0)
	document.getElementById('high-score').innerText = parseInt(localStorage.getItem('highScore') || 0).toLocaleString()
	document.getElementById('timer').innerText = startTime === -1 ? '0:00' : msToTime(Date.now() - startTime)
	
	if (!gameStarted) {
		if (keys2.includes(' ')) {
			score = 0
			level = 0
			collapsedRowsSinceLevel = 0
			gameStarted = true
			startTime = Date.now()
			document.getElementById('start').style.display = 'none'
		}
		cleanup()
		return
	}

	// Update score and stuff
	document.getElementById('level').innerText = level.toLocaleString()
	document.getElementById('score').innerText = score.toLocaleString()
	document.getElementById('clear').innerText = (6 * (level + 1) - collapsedRowsSinceLevel).toLocaleString()

	// Render previews and stuff
	for (let i = 0; i < 4; i++) {
		const bigRowOffset = i * (previewSizeB + previewMarginVB)

		stroke('#222222')
		strokeWeight(2)
		noFill()
		rect(
			1,
			(boardHeightB - previewSizeB - bigRowOffset) * b2p - 1,
			previewSizeB * b2p - 2,
			previewSizeB * b2p
		)
		rect(
			(previewSizeB + previewMarginB * 2 + boardWidthB) * b2p + 1,
			(boardHeightB - previewSizeB - bigRowOffset) * b2p - 1,
			previewSizeB * b2p - 2,
			previewSizeB * b2p
		)

		const rowOffset1 = (queue1[i].blocks.length <= 3 ? 1 : 0) + bigRowOffset
		const colOffset1 = (queue1[i].blocks.length === 2 ? 1 : 0)
		for (let row = 0; row < queue1[i].blocks.length; row++) { 
			for (let col = 0; col < queue1[i].blocks[0].length; col++) {
				if (!queue1[i].blocks[row][col]) continue
				drawBlock(
					boardHeightB - 1 - row - rowOffset1,
					col + colOffset1,
					queue1[i].color
				)
			}
		}

		const rowOffset2 = (queue2[i].blocks.length <= 3 ? 1 : 0) + bigRowOffset
		const colOffset2 = (queue2[i].blocks.length === 2 ? 1 : 0) + (previewSizeB + previewMarginB * 2 + boardWidthB)
		for (let row = 0; row < queue2[i].blocks.length; row++) { 
			for (let col = 0; col < queue2[i].blocks[0].length; col++) {
				if (!queue2[i].blocks[row][col]) continue
				drawBlock(
					boardHeightB - 1 - row - rowOffset2,
					col + colOffset2,
					queue2[i].color
				)
			}
		}
	}

	// Swap uwu
	stroke('#222222')
	strokeWeight(2)
	noFill()
	rect(
		1,
		1,
		previewSizeB * b2p - 2,
		previewSizeB * b2p
	)
	rect(
		(previewSizeB + previewMarginB * 2 + boardWidthB) * b2p + 1,
		1,
		previewSizeB * b2p - 2,
		previewSizeB * b2p
	)

	if (hold1) {
		const rowOffset1 = hold1.blocks.length <= 3 ? 1 : 0
		const colOffset1 = hold1.blocks.length === 2 ? 1 : 0
		for (let row = 0; row < hold1.blocks.length; row++) { 
			for (let col = 0; col < hold1.blocks[0].length; col++) {
				if (!hold1.blocks[row][col]) continue
				drawBlock(
					row + rowOffset1,
					col + colOffset1,
					hold1.color
				)
			}
		}
	}
	if (hold2) {
		const rowOffset2 = hold2.blocks.length <= 3 ? 1 : 0
		const colOffset2 = (hold2.blocks.length === 2 ? 1 : 0) + (previewSizeB + previewMarginB * 2 + boardWidthB)
		for (let row = 0; row < hold2.blocks.length; row++) { 
			for (let col = 0; col < hold2.blocks[0].length; col++) {
				if (!hold2.blocks[row][col]) continue
				drawBlock(
					row + rowOffset2,
					col + colOffset2,
					hold2.color
				)
			}
		}
	}

	// Input handling
	const autoDropTime = (vFramesPerLevel[level] || 1) * 1000 / 60
	const softDropTime = Math.min(maxSoftDropTime, autoDropTime)

	document.body.classList.toggle('shake', shakeCount > 0)
	document.body.classList.toggle('flicker', flickerCount > 0)
	
	const isInterval = (ms) => Date.now() % ms < lastDateNow % ms
	const isSince = (time, ms) => Date.now() >= (time + ms)

	try {
		const key1 = keys1[0]
		const key2 = keys2[0]
		if (key1) {
			if ([ 'a', 'd' ].includes(key1) && isInterval(lateralTime)) {
				if (key1 === 'a') {
					if (!collidesOrBreaks(current1.blocks, current1.row, current1.col - 1, blocks)) {
						current1.col--
						movementSound.currentTime = 0
						movementSound.play()
						if (startLock1) startLock1 = Date.now()
					}
				} else if (key1 === 'd') {
					if (!collidesOrBreaks(current1.blocks, current1.row, current1.col + 1, blocks)) {
						current1.col++
						movementSound.currentTime = 0
						movementSound.play()
						if (startLock1) startLock1 = Date.now()
					}
				}
			}

			if (key1 === 's' && !lastKeys1.includes(key1) && !collidesOrBreaks(
				rotateBlocks(current1.blocks), current1.row, current1.col, blocks
			)) {
				current1.blocks = rotateBlocks(current1.blocks)
				rotateSound.currentTime = 0
				rotateSound.play()
			}
			if (!startLock1 && key1 === 'w' && isInterval(softDropTime) && !isInterval(autoDropTime)) {
				current1.row++
			}
			if (!startLock1 && key1 === 'w' && isInterval(softDropTime * 2) && !isInterval(autoDropTime)) {
				movementSound.currentTime = 0
				movementSound.play()
			}

			if (!startLock1 && key1 === 'c' && !swapped1) {
				current1.row = -1
				const newHold1 = { ...current1 }
				current1 = { ...current1, ...(hold1 || queue1.shift()) }
				hold1 = newHold1
				const rightDiff = boardWidthB - (current1.col + getMaxLeft(current1.blocks))
				if (rightDiff < 0) current1.col += rightDiff
				if (current1.col < 0) current1.col = 0
				swapped1 = true
				holdSound.currentTime = 0
				holdSound.play()
			}
		}
		if (key2) {
			if ([ 'j', 'l' ].includes(key2) && isInterval(lateralTime)) {
				if (key2 === 'j') {
					if (!collidesOrBreaks(current2.blocks, current2.row, current2.col - 1, blocks)) {
						current2.col--
						movementSound.currentTime = 0
						movementSound.play()
						if (startLock2) startLock2 = Date.now()
					}
				} else if (key2 === 'l') {
					if (!collidesOrBreaks(current2.blocks, current2.row, current2.col + 1, blocks)) {
						current2.col++
						movementSound.currentTime = 0
						movementSound.play()
						if (startLock2) startLock2 = Date.now()
					}
				}
			}

			if (key2 === 'k' && !lastKeys2.includes(key2) && !collidesOrBreaks(
				rotateBlocks(current2.blocks), current2.row, current2.col, blocks
			)) {
				current2.blocks = rotateBlocks(current2.blocks)
				rotateSound.currentTime = 0
				rotateSound.play()
			}
			if (!startLock2 && key2 === 'i' && isInterval(softDropTime) && !isInterval(autoDropTime)) {
				current2.row++
			}
			if (!startLock2 && key2 === 'i' && isInterval(softDropTime * 2) && !isInterval(autoDropTime)) {
				movementSound.currentTime = 0
				movementSound.play()
			}

			if (!startLock2 && key2 === 'n' && !swapped2) {
				current2.row = -1
				const newHold2 = { ...current2 }
				current2 = { ...current2, ...(hold2 || queue2.shift()) }
				hold2 = newHold2
				const rightDiff = boardWidthB - (current2.col + getMaxLeft(current2.blocks))
				if (rightDiff < 0) current2.col += rightDiff
				if (current2.col < 0) current2.col = 0
				swapped2 = true
				holdSound.currentTime = 0
				holdSound.play()
			}
		}
		if (key2 === ' ' && !lastKeys2.includes(' ')) {
			console.log('locking (1 + 2)')
			swapped1 = false
			swapped2 = false

			lockSound.currentTime = 0
			lockSound.play()
			startLock1 = undefined
			startLock2 = undefined

			current1 = testDrop(current1)
			current2 = testDrop(current2)

			for (let row = 0; row < current1.blocks.length; row++) { 
				for (let col = 0; col < current1.blocks[0].length; col++) {
					if (current1.blocks[row][col] !== 1) continue
					blocks[row + current1.row][col + current1.col] = current1.color
				}
			}
			for (let row = 0; row < current2.blocks.length; row++) { 
				for (let col = 0; col < current2.blocks[0].length; col++) {
					if (current2.blocks[row][col] !== 1) continue
					blocks[row + current2.row][col + current2.col] = current2.color
				}
			}

			current1 = { row: -1, ...queue1.shift() }
			current1.col = Math.floor(Math.random() * (boardWidthB - current1.blocks[0].length))
			current2 = { row: -1, ...queue2.shift() }
			current2.col = Math.floor(Math.random() * (boardWidthB - current2.blocks[0].length))
			
			swapSidesIfNeeded()
			shakeCount++
			setTimeout(() => shakeCount--, shakeTime)
		}

		if (isInterval(autoDropTime)) {
			if (!startLock1) current1.row++
			if (!startLock2) current2.row++
			if (!startLock1 || !startLock2) {
				movementSound.currentTime = 0
				movementSound.play()
			}
		}

		if (collidesOrBreaks(current1.blocks, current1.row + 1, current1.col, blocks)) {
			if (!startLock1) startLock1 = Date.now()
		} else if (startLock1) startLock1 = undefined
		if (collidesOrBreaks(current2.blocks, current2.row + 1, current2.col, blocks)) {
			if (!startLock2) startLock2 = Date.now()
		} else if (startLock2) startLock2 = undefined

		if (startLock1 && isSince(startLock1, lockTime)) {
			console.log('locking (1)')
			swapped1 = false

			lockSound.currentTime = 0
			lockSound.play()
			startLock1 = undefined

			for (let row = 0; row < current1.blocks.length; row++) { 
				for (let col = 0; col < current1.blocks[0].length; col++) {
					if (current1.blocks[row][col] !== 1) continue
					blocks[row + current1.row][col + current1.col] = current1.color
				}
			}
			
			current1 = { row: -1, ...queue1.shift() }
			current1.col = Math.floor(Math.random() * (boardWidthB - current1.blocks[0].length))
			swapSidesIfNeeded()

			shakeCount++
			setTimeout(() => shakeCount--, shakeTime)
		}
		if (startLock2 && isSince(startLock2, lockTime)) {
			console.log('locking (2)')
			swapped2 = false

			lockSound.currentTime = 0
			lockSound.play()
			startLock2 = undefined

			for (let row = 0; row < current2.blocks.length; row++) { 
				for (let col = 0; col < current2.blocks[0].length; col++) {
					if (current2.blocks[row][col] !== 1) continue
					blocks[row + current2.row][col + current2.col] = current2.color
				}
			}
			
			current2 = { row: -1, ...queue2.shift() }
			current2.col = Math.floor(Math.random() * (boardWidthB - current2.blocks[0].length))
			swapSidesIfNeeded()

			shakeCount++
			setTimeout(() => shakeCount--, shakeTime)
		}

		// Collapse all the things
		{
			let collapsedRows = 0
			for (let row = 0; row < blocks.length; row++) {
				const sum = blocks[row]
					.map((block) => block ? 1 : 0)
					.reduce((p, c) => p + c, 0)
				const filled = sum === blocks[0].length

				if (filled) {
					collapsedRows++
					blocks.splice(row, 1)
					blocks.unshift(new Array(blocks[0].length).fill(null))
				}
			}
			if (collapsedRows > 0) {
				collapseSound.currentTime = 0
				collapseSound.play()

				let base = 4000
				if (collapsedRows === 2) {
					base = 10000
				} else if (collapsedRows === 3) {
					base = 30000
				} else if (collapsedRows === 4) {
					base = 120000
				}

				score += base * (level + 1)
				if (score > (localStorage.getItem('highScore') || 0)) {
					localStorage.setItem('highScore', score)
				}
				collapsedRowsSinceLevel += collapsedRows
				if (collapsedRowsSinceLevel >= 6 * (level + 1)) {
					collapsedRowsSinceLevel = 0
					level++
					levelSound.currentTime = 0
					levelSound.play()
				}

				flickerCount++
				setTimeout(() => flickerCount--, flickerTimeBase * collapsedRows)
			}
		}

		// Render the main game
		const leftOffsetB = previewSizeB + previewMarginB

		stroke('#222222')
		strokeWeight(2)
		noFill()
		rect(
			leftOffsetB * b2p,
			1,
			boardWidthB * b2p,
			(boardHeightB * b2p) - 2
		)

		noStroke()
		for (let row = 1; row < boardHeightB; row++) { 
			for (let col = 1; col < boardWidthB; col++) {
				circle((leftOffsetB + col) * b2p, row * b2p, 3)
			}
		}

		for (let row = 0; row < boardHeightB; row++) { 
			for (let col = 0; col < boardWidthB; col++) {
				if (blocks[row][col]) {
					drawBlock(
						row,
						leftOffsetB + col,
						blocks[row][col]
					)
				}
			}
		}

		for (const ghost of [ testDrop(current1), testDrop(current2) ]) {
			for (let row = 0; row < ghost.blocks.length; row++) { 
				for (let col = 0; col < ghost.blocks[0].length; col++) {
					if (!ghost.blocks[row][col]) continue
					drawBlock(
						row + ghost.row,
						leftOffsetB + col + ghost.col,
						'#222222'
					)
				}
			}
		}

		for (let row = 0; row < current1.blocks.length; row++) { 
			for (let col = 0; col < current1.blocks[0].length; col++) {
				if (!current1.blocks[row][col]) continue
				drawBlock(
					row + current1.row,
					leftOffsetB + col + current1.col,
					current1.color
				)
			}
		}
		for (let row = 0; row < current2.blocks.length; row++) { 
			for (let col = 0; col < current2.blocks[0].length; col++) {
				if (!current2.blocks[row][col]) continue
				drawBlock(
					row + current2.row,
					leftOffsetB + col + current2.col,
					current2.color
				)
			}
		}
	} catch (error) {
		// Lose condition LMFAOOO SO JANKY
		console.warn(error)
		gameStarted = false

		document.getElementById('start').innerText = 'you lost! press space to play again'
		document.getElementById('start').style.display = 'block'

		queue1 = makeQueue()
		current1 = { row: -1, ...queue1.shift() }
		startLock1 = undefined
		hold1 = undefined
		swapped1 = false
		current1.col = Math.floor(Math.random() * (boardWidthB - current1.blocks[0].length))

		queue2 = makeQueue()
		current2 = { row: -1, ...queue2.shift() }
		startLock2 = undefined
		hold2 = undefined
		swapped2 = false
		current2.col = Math.floor(Math.random() * (boardWidthB - current2.blocks[0].length))

		for (let row = 0; row < boardHeightB; row++) {
			blocks[row] = new Array(boardWidthB).fill(null)
		}
	}

	cleanup()
}

function keyPressed() {
	if (keys1.includes(key) || keys2.includes(key)) return
	if (allKeys1.includes(key)) {
		keys1.unshift(key)
	} else {
		keys2.unshift(key)
	}
}

function keyReleased() {
	if (allKeys1.includes(key)) {
		keys1.splice(keys1.indexOf(key), 1)
	} else {
		keys2.splice(keys2.indexOf(key), 1)
	}
}