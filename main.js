// internal variables
var _canvas;
var _midi;
var _fps = 60;
var _width;
var _height;
var _ctx;
var _obsts = [];
var _rateOfChange = 0;
var _playerX;
var _projectedPos;
var _playerY = 140;
var _lastNote = 60;
var _state;
var _lastT = 0;
var _numKeysPressed = 0;
var _curNote = 60;
var _bottomNote = 21;
var _topNote = 108;
var _pressedNotes = new Set();
var _selectedKeyboard;

// constants
var NOTENAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// game states
const NEW = 0;
const GAME = 1;
const OVER = 2;

// variables that change how the game behaves
const flyableSpace = 350;
const obstacleHeight = 15;
const maxRateOfChange = 25;
const playerSize = 15;
const speed = 3.5;


function noteNumberToName(midiNumber) {
    let noteNameInd = midiNumber % 12;
    let octave = Math.floor(midiNumber/12);
    return NOTENAMES[noteNameInd] + octave;
}

function init() {
    _canvas = document.getElementById("main")
    _width = window.innerWidth;
    _height = window.innerHeight;
    _canvas.width = _width;
    _canvas.height = _height;
    _ctx = _canvas.getContext("2d")
    _playerX = _width * (_lastNote-_bottomNote)/(_topNote-_bottomNote);
    _state = NEW;
    reset();

    requestAnimationFrame(step);
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
}

function reset() {
    _obsts = [];
    _lastNote = 60;
    _playerdX = 0;
    _playerX = _width * (_lastNote-_bottomNote)/(_topNote-_bottomNote);
    _projectedPos = _playerX;
}

function onMIDISuccess(a) {
    _midi = a;
    let inputs = _midi.inputs.values();
    for (input = inputs.next(); input && !input.done; input = inputs.next()) {
        input.value.onmidimessage = onMIDIMessage;
    }
}

function onMIDIMessage(e) {
    let data = e.data;
    let type = data[0] & 0xf0;
    let note = data[1];
    let target = e.target;

    if(type == 144) { // note down
        _numKeysPressed++;
        _pressedNotes.add(note);
        if(_state == NEW) {
            if(_numKeysPressed == 2) {
                _topNote = Math.max(..._pressedNotes);
                _bottomNote = Math.min(..._pressedNotes);
                _selectedKeyboard = target;
                console.log("calibrated", _topNote, _bottomNote);
            } else if(note == 60 && target == _selectedKeyboard) {
                reset();
                _state = GAME;
            }
            
        } else if(_state == GAME) {
            if(target == _selectedKeyboard) {
                if(note == _lastNote+1) {
                    _lastNote = note;
                    _curNote = note;
                } else if(note == _lastNote-1) {
                    _lastNote = note;
                    _curNote = note;
                }
            }
           
            _projectedPos = _width * (_lastNote-_bottomNote)/(_topNote-_bottomNote)
        } else if(_state == OVER && note == 60) {
            reset();
            _state = NEW;
        }
    } else if (type == 128) { // note up
        _numKeysPressed--;
        _pressedNotes.delete(note);
    }
}

function onMIDIFailure(e) {
    console.error(e)
}

function mvObsts() {
    for(let obst_idx in _obsts) {
        _obsts[obst_idx].y -= speed;
    }
}

function rmOldObsts() {
    if(_obsts.length > 0 && _obsts[0].y + obstacleHeight < 0) _obsts.splice(0, 1);
}

function fillObsts() {
    if(_obsts.length == 0) {
        _obsts.push({
            x: _width/2,
            y: 0
        });
    }
    let cury = _obsts[_obsts.length - 1].y; 
    while(cury + obstacleHeight < _height) {
        let curx = _obsts[_obsts.length - 1].x;
        let nextx = curx + _rateOfChange;
        let nexty = cury + obstacleHeight;

        let rightBound = _width-flyableSpace/2;
        let leftBound = flyableSpace/2;
        nextx = Math.min(rightBound, Math.max(leftBound, nextx));
        if(nextx == leftBound || nextx == rightBound) _rateOfChange *= -.25;

        _obsts.push({
            x: nextx,
            y: nexty
        })
        cury = nexty;

        _rateOfChange += (Math.random() - .5)*3;
        _rateOfChange = Math.max(-maxRateOfChange, Math.min(maxRateOfChange, _rateOfChange));
    }
}

function isCollide() {
    for(let obst_idx in _obsts) {
        let obst = _obsts[obst_idx];
        if(obst.y < _playerY+playerSize && obst.y + obstacleHeight > _playerY) {
            if(_playerX < obst.x-flyableSpace/2 || _playerX+playerSize > obst.x+flyableSpace/2) {
                return true;
            }
        } else if (obst.y > _playerY+playerSize) {
            break;
        }
    }
    return false;
}

function drawPlayer() {
    if(_state != OVER) {
        _ctx.rect(_playerX, _playerY, 15, 15);
        _ctx.fillStyle = "#fff";
        _ctx.fill();
    }
}

function drawObstacles() {
    const gap = 0;
    for(let obst_idx in _obsts) {
        let obst = _obsts[obst_idx];

        let leftBound = obst.x - flyableSpace/2;
        _ctx.rect(0, obst.y, leftBound, obstacleHeight-gap);

        let rightBound = obst.x + flyableSpace/2;
        _ctx.rect(rightBound, obst.y, _width-rightBound, obstacleHeight-gap);
    }
    _ctx.fillStyle = "#fff";
    _ctx.fill();
}

function drawText() {
    const leftMargin = 60;
    _ctx.globalCompositeOperation = 'difference';
    switch(_state) {
    case NEW:
        _ctx.font = "90pt VT323";
        _ctx.fillText("Helikeypter", leftMargin, 100);
        _ctx.font = "40pt VT323";
        _ctx.fillText("Instructions:", leftMargin, 200);
        _ctx.font = "30pt VT323";
        _ctx.fillText("Move left and right by moving up and down chromatic", leftMargin, 250);
        _ctx.fillText("scales. Start by pressing middle C.", leftMargin, 285);
        _ctx.fillText("Press the highest and lowest keys on your keyboard to", leftMargin, 335);
        _ctx.fillText("calibrate the game for your keyboard.", leftMargin, 370);
        if(_selectedKeyboard) {
            _ctx.fillText("Current keyboard: ", leftMargin, 420);
            _ctx.fillText(_selectedKeyboard.name, leftMargin+50, 455);
            _ctx.fillText((_topNote-_bottomNote+1)+" keys, "
                +noteNumberToName(_bottomNote)+"-"+noteNumberToName(_topNote), leftMargin+50, 490);
        } else {
            _ctx.fillText("No keyboard selected", leftMargin, 420);
        }
        break;
    case GAME:
        _ctx.font = "30pt VT323";
        _ctx.fillText(noteNumberToName(_curNote), leftMargin, leftMargin);
        break;
    case OVER:
        _ctx.font = "90pt VT323";
        _ctx.fillText("Game over!", leftMargin, 100);
        _ctx.font = "30pt VT323";
        _ctx.fillText("Press middle C to restart.", leftMargin+10, 135);
        break;
    }
    _ctx.globalCompositeOperation = 'normal';
}

function update(t) {
    if(_state == NEW  && _obsts.length > Math.floor(_playerY/obstacleHeight)) {
        _projectedPos = _obsts[Math.floor(_playerY/obstacleHeight)].x;
    }

    dx = (_projectedPos - _playerX)*(t-_lastT)/250;
    _playerX += dx;

    if(isCollide() && _state == GAME) {
        _state = OVER;
    }

    mvObsts();
    rmOldObsts();
    fillObsts();
}

function step(t) {
    // clear screen
    _ctx.clearRect(0, 0, _width, _height);
    _ctx.fillStyle = "#000";
    _ctx.fillRect(0, 0, _width, _height);

    update(t);

    _ctx.beginPath();
    drawPlayer();
    drawObstacles();
    drawText();

    _lastT = t;

    requestAnimationFrame(step);
}

init();