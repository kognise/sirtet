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

const b2p = 30
const boardWidthB = 10
const boardHeightB = 20
const previewMarginB = 2
const previewMarginVB = 0.7
const previewSizeB = 4

const lateralTime = 120
const maxSoftDropTime = 24
const lockTime = 500
const shakeTime = 80
const flickerTimeBase = 100

const lockSound = new Audio('sounds/wow.mp3')
const movementSound = new Audio('sounds/tick.mp3')
const rotateSound = new Audio('sounds/squeak.mp3')
const collapseSound = new Audio('sounds/whoosh.mp3')
const holdSound = new Audio('sounds/beep.mp3')
const levelSound = new Audio('sounds/bwong.mp3')

let latS = {}

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

let queue = makeQueue()
let current = { row: -1, ...queue.shift() }
let startLock
let hold
let swapped = false
current.col = Math.floor(Math.random() * (boardWidthB - current.blocks[0].length))

// Initialize things
for (let row = 0; row < boardHeightB; row++) {
	blocks[row] = new Array(boardWidthB).fill(null)
}

// All the main logic
function setup() {
	createCanvas((previewSizeB + previewMarginB + boardWidthB + previewMarginB + previewSizeB) * b2p, boardHeightB * b2p)
}

const keys = []
let lastKeys = keys
let lastDateNow = 0

let shakeCount = 0
let flickerCount = 0

let score = 0
let level = 0
let collapsedRowsSinceLevel = 0
let startTime = -1

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
	lastKeys = [ ...keys ]

	if (queue.length < pieces.length) queue = queue.concat(makeQueue())
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
		if (keys.includes(' ')) {
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
	for (let i = 0; i < 3; i++) {
		const bigRowOffset = i * (previewSizeB + previewMarginVB)

		stroke('#222222')
		strokeWeight(2)
		noFill()
		rect(
			(previewMarginB + previewSizeB + previewMarginB + boardWidthB) * b2p + 1,
			(boardHeightB - previewSizeB - bigRowOffset) * b2p - 1,
			previewSizeB * b2p - 2,
			previewSizeB * b2p
		)

		const rowOffset = (queue[i].blocks.length <= 3 ? 1 : 0) + bigRowOffset
		const colOffset = (queue[i].blocks.length === 2 ? 1 : 0) + (previewMarginB + previewSizeB + previewMarginB + boardWidthB)
		for (let row = 0; row < queue[i].blocks.length; row++) { 
			for (let col = 0; col < queue[i].blocks[0].length; col++) {
				if (!queue[i].blocks[row][col]) continue
				drawBlock(
					boardHeightB - 1 - row - rowOffset,
					col + colOffset,
					queue[i].color
				)
			}
		}
	}

	// Swap uwu
	stroke('#222222')
	strokeWeight(2)
	noFill()
	rect(
		(previewMarginB + previewSizeB + previewMarginB + boardWidthB) * b2p + 1,
		1,
		previewSizeB * b2p - 2,
		previewSizeB * b2p
	)

	if (hold) {
		const rowOffset2 = hold.blocks.length <= 3 ? 1 : 0
		const colOffset2 = (hold.blocks.length === 2 ? 1 : 0) + (previewMarginB + previewSizeB + previewMarginB + boardWidthB)
		for (let row = 0; row < hold.blocks.length; row++) { 
			for (let col = 0; col < hold.blocks[0].length; col++) {
				if (!hold.blocks[row][col]) continue
				drawBlock(
					row + rowOffset2,
					col + colOffset2,
					hold.color
				)
			}
		}
	}

	// Input handling
	const autoDropTime = (vFramesPerLevel[level] || 1) * 1000 / 60
	const softDropTime = Math.min(maxSoftDropTime, autoDropTime)

	document.body.classList.toggle('shake', shakeCount > 0)
	document.body.classList.toggle('flicker', flickerCount > 0)
	
	const isInterval = (ms, s = 0) => (Date.now() - s) % ms < (lastDateNow - s) % ms
	const isSince = (time, ms) => Date.now() >= (time + ms)

	try {
		const pressedKey = keys[0]
		if (pressedKey) {
			if ([ 'ArrowLeft', 'ArrowRight' ].includes(pressedKey) && (isInterval(lateralTime, latS[pressedKey] ?? 0) || !lastKeys.includes(pressedKey))) {
				if (!lastKeys.includes(pressedKey)) {
					latS[pressedKey] = Date.now()
				}
				if (pressedKey === 'ArrowLeft') {
					if (!collidesOrBreaks(current.blocks, current.row, current.col - 1, blocks)) {
						current.col--
						movementSound.currentTime = 0
						movementSound.play()
						if (startLock) startLock = Date.now()
					}
				} else if (pressedKey === 'ArrowRight') {
					if (!collidesOrBreaks(current.blocks, current.row, current.col + 1, blocks)) {
						current.col++
						movementSound.currentTime = 0
						movementSound.play()
						if (startLock) startLock = Date.now()
					}
				}
			}

			if (pressedKey === 'ArrowUp' && !lastKeys.includes(pressedKey) && !collidesOrBreaks(
				rotateBlocks(current.blocks), current.row, current.col, blocks
			)) {
				current.blocks = rotateBlocks(current.blocks)
				rotateSound.currentTime = 0
				rotateSound.play()
			}
			if (!startLock && pressedKey === 'ArrowDown' && isInterval(softDropTime) && !isInterval(autoDropTime)) {
				current.row++
			}
			if (!startLock && pressedKey === 'ArrowDown' && isInterval(softDropTime * 2) && !isInterval(autoDropTime)) {
				movementSound.currentTime = 0
				movementSound.play()
			}

			if (!startLock && pressedKey === 'c' && !swapped) {
				current.row = -1
				const newHold1 = { ...current }
				current = { ...current, ...(hold || queue.shift()) }
				hold = newHold1
				const rightDiff = boardWidthB - (current.col + getMaxLeft(current.blocks))
				if (rightDiff < 0) current.col += rightDiff
				if (current.col < 0) current.col = 0
				swapped = true
				holdSound.currentTime = 0
				holdSound.play()
			}
		}
		if (pressedKey === ' ' && !lastKeys.includes(' ')) {
			console.log('locking (1 + 2)')
			swapped = false

			lockSound.currentTime = 0
			lockSound.play()
			startLock = undefined

			current = testDrop(current)

			for (let row = 0; row < current.blocks.length; row++) { 
				for (let col = 0; col < current.blocks[0].length; col++) {
					if (current.blocks[row][col] !== 1) continue
					blocks[row + current.row][col + current.col] = current.color
				}
			}

			current = { row: -1, ...queue.shift() }
			current.col = Math.floor(Math.random() * (boardWidthB - current.blocks[0].length))
			
			shakeCount++
			setTimeout(() => shakeCount--, shakeTime)
		}

		if (isInterval(autoDropTime)) {
			if (!startLock) {
				current.row++
				movementSound.currentTime = 0
				movementSound.play()
			}
		}

		if (collidesOrBreaks(current.blocks, current.row + 1, current.col, blocks)) {
			if (!startLock) startLock = Date.now()
		} else if (startLock) startLock = undefined

		if (startLock && isSince(startLock, lockTime)) {
			console.log('locking')
			swapped = false

			lockSound.currentTime = 0
			lockSound.play()
			startLock = undefined

			for (let row = 0; row < current.blocks.length; row++) { 
				for (let col = 0; col < current.blocks[0].length; col++) {
					if (current.blocks[row][col] !== 1) continue
					blocks[row + current.row][col + current.col] = current.color
				}
			}
			
			current = { row: -1, ...queue.shift() }
			current.col = Math.floor(Math.random() * (boardWidthB - current.blocks[0].length))

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
		fill('#222222')
		for (let row = 1; row < boardHeightB; row++) { 
			for (let col = 1; col < boardWidthB; col++) {
				circle((leftOffsetB + col) * b2p, row * b2p, 1.5)
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

		const ghost = testDrop(current)
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

		for (let row = 0; row < current.blocks.length; row++) { 
			for (let col = 0; col < current.blocks[0].length; col++) {
				if (!current.blocks[row][col]) continue
				drawBlock(
					row + current.row,
					leftOffsetB + col + current.col,
					current.color
				)
			}
		}
	} catch (error) {
		// Lose condition LMFAOOO SO JANKY
		console.warn(error)
		gameStarted = false

		document.getElementById('start').innerText = 'you lost! press space to play again'
		document.getElementById('start').style.display = 'block'

		queue = makeQueue()
		current = { row: -1, ...queue.shift() }
		startLock = undefined
		hold = undefined
		swapped = false
		current.col = Math.floor(Math.random() * (boardWidthB - current.blocks[0].length))

		for (let row = 0; row < boardHeightB; row++) {
			blocks[row] = new Array(boardWidthB).fill(null)
		}
	}

	cleanup()
}

function keyPressed() {
	if (keys.includes(key)) return
	keys.unshift(key)
}

function keyReleased() {
	keys.splice(keys.indexOf(key), 1)
}