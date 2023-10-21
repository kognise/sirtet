let canvas
let width
let height

window.addEventListener('keydown', (event) => {
	if (!event.key) return
	window.key = event.key
	console.log('down', key)
	keyPressed()
	window.key = null
})
window.addEventListener('keyup', (event) => {
	window.key = event.key
	console.log('up', key)
	keyReleased()
	window.key = null
})

function createCanvas(w, h) {
	width = w
	height = h
	canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	document.body.appendChild(canvas)
	canvas = canvas.getContext('2d')
}

function background(color) {
	canvas.fillStyle = color || '#000000'
	canvas.fillRect(0, 0, width, height)
}

function fill(color) {
	canvas.fillStyle = color
}

function stroke(color) {
	canvas.strokeStyle = color
}

function strokeWeight(weight) {
	canvas.lineWidth = weight
}

function noFill() {
	canvas.fillStyle = 'transparent'
}

function noStroke() {
	canvas.strokeStyle = 'transparent'
}

function circle(x, y, r) {
	const path = new Path2D()
	path.ellipse(x - r, y - r, r, r, 0, 0, Math.PI * 2)
	canvas.fill(path)
	canvas.stroke(path)
}

function rect(x, y, w, h) {
	canvas.fillRect(x, y, w, h)
	canvas.strokeRect(x, y, w, h)
}

function square(x, y, size) {
	rect(x, y, size, size)
}

setup()
function requestDraw() {
	requestAnimationFrame(requestDraw)
	draw()
}
requestAnimationFrame(requestDraw)