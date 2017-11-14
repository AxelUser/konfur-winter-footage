var Vector = function(x, y){
    'use strict';

    this.x = x || 0;
    this.y = y || 0;

    var dx, dy;

    this.add = function(v){
        this.x += v.x;
        this.y += v.y;
        return this;
    };

    this.sub = function(v){
        this.x -= v.x;
        this.y -= v.y;
        return this;
    };

    this.nor = function(){
        var d = this.len();
        if(d > 0) {
            this.x = this.x / d;
            this.y = this.y / d;
        }
        return this;
    };

    this.dot = function(v){
        return this.x * v.x + this.y * v.y;
    };


    this.len2 = function(){
        return this.dot(this);
    };

    this.len = function(){
        return Math.sqrt(this.len2());
    };

    this.mul = function(v){
        if(typeof v === 'object'){
            this.x *= v.x;
            this.y *= v.y;
        } else {
            this.x *= v;
            this.y *= v;
        }

        return this;
    };

    this.copyFrom = function(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    };

    this.distance = function(v){
        dx = this.x - v.x;
        dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    };
};

var Particle = function(id, x, y){
    this.id = id;
    this.position = new Vector(x, y);
    this.velocity = new Vector();
    this.speed = 0;
    this.parentId = null;
    this.connectionsMap = {};
    this.childs = [];
    this.linked = false;
    this.distance = false;
    this.alpha = 0.3;
    this.hasError = false;

    this.connectionsAlphaInc = 0.01;

    this.cell = null;
    this.isCustom = false;
    
    this.jointAlpha = 0.8;
    this.linkAlpha = this.alpha;
    this.linkToParentAlpha = 0;

    var acceleration = new Vector(),
        i = 0;

    
    this.riseError = function() {
        this.hasError = true;
        this.cell.hasError = true;
    }

    this.update = function(delta){
        acceleration = acceleration.copyFrom(this.velocity);
        acceleration.mul(this.speed * delta);
        this.position.add(acceleration);
        this.jointAlpha = 0.8;
        this.linkAlpha = this.alpha;
    }

    this.addChilds = function(childs){
        var newAlpha = 0;
        var child = null;
        var newConnections = {};
        var newChilds = [];
        for (var i = 0; i < childs.length; i++) {
            child = childs[i];
            newAlpha = this.connectionsMap[child.id+""] != null? this.connectionsMap[child.id+""] + this.connectionsAlphaInc: 0;
            newConnections[child.id+""] = newAlpha <= 0.3? newAlpha: 0.3;
            newChilds.push(child);
        }
        this.connectionsMap = newConnections;
        this.childs = newChilds;
        
    }
    this.removeChild = function(link){
        for(i = 0; i < this.childs.length; i++){
            if(this.childs[i] === link){
                this.childs.splice(i,1);
            }
        }
    }
};

var GridCell = function(id, rowIndex, colIndex, posLeftTop, width, height) {
    'use strict';

    this.isCustom = false;

    this.id = id || 0;
    this.width = width || 0;
    this.height = height || 0;
    this.rowIndex = rowIndex || 0;
    this.colIndex = colIndex || 0;

    this.top = posLeftTop.y;
    this.bottom = posLeftTop.y + height;
    this.left = posLeftTop.x;
    this.right = posLeftTop.x + width;

    this.hasError = false;

    this.particles = [];
    this.neighbors = [];

    this.setParticles = function(particles) {
        self = this;
        this.particles = [].concat(particles.map(function(p){
            p.cell = self;
            return p;
        }));
    }

    this.addParticle = function(particle) {
        particle.cell = this;
        this.particles.push(particle);
    }

    this.check = function() {
        for(var i = 0; i < this.particles.length; i++) {
            var posX = this.particles[i].position.x;
            var posY = this.particles[i].position.y;
            if(Math.ceil(posX) < this.left || Math.floor(posX) > this.right || Math.ceil(posY) < this.top || Math.floor(posY) > this.bottom){
                return false;
            }
        }
        return true;
    }

    this.removeGoneParticles = function() {
        var removedParticles = [];
        var savedParticles = [];
        var posX = 0;
        var posY = 0;
        for(var i = 0; i < this.particles.length; i++) {
            posX = Math.round(this.particles[i].position.x);
            posY = Math.round(this.particles[i].position.y);
            if(Math.ceil(posX) < this.left || Math.floor(posX) > this.right || Math.ceil(posY) < this.top || Math.floor(posY) > this.bottom){
                this.particles[i].cell = null;
                removedParticles.push(this.particles[i]);
            } else {
                savedParticles.push(this.particles[i]);
            }
        }

        if(savedParticles.length < this.particles.length) {
            this.setParticles(savedParticles);
        }

        return removedParticles;
    }
}

var ParticleGrid = function(width, height, particles, enableDebug) {
    'use strict';
    
    this.cells = [];

    this.cellFixedWidth = 32;
    this.cellFixedHeight = 32;

    this.debugMode = enableDebug || false;

    this.rowsCount = 0;
    this.colsCount = 0;

    this.cellsSearchRadius = 3;
    this.cellsIgnoreRadius = 1;
    this.maxJoins = 0;
    
    this.distanceErrorThreshold = 200;

    this.getCellForParticle = function (particle) {
        var xIndex = Math.floor(particle.position.x / this.cellFixedWidth);
        var yIndex = Math.floor(particle.position.y / this.cellFixedHeight);
        return this.cells[yIndex][xIndex];
    }
    


    this.initGrid = function (width, height, particles) {
        var id = 0;
        this.cells = [];
        this.rowsCount = 0;
        
        for(var sumHeight = 0; sumHeight < height; sumHeight += this.cellFixedHeight, this.rowsCount++){
            this.colsCount = 0;
            this.cells.push([]);
            for(var sumWidth = 0; sumWidth < width; sumWidth += this.cellFixedWidth, this.colsCount++, id++){
                var pos = new Vector(sumWidth, sumHeight);
                var h = sumHeight + this.cellFixedHeight <= height? this.cellFixedHeight: height - sumHeight;
                var w = sumWidth + this.cellFixedWidth <= width? this.cellFixedWidth: width - sumWidth;
                this.cells[this.rowsCount].push(new GridCell(id, this.rowsCount, this.colsCount, pos, w, h));
            }
        }
        
        this.initNeighborsForCells();

        for(var i = 0; i < particles.length; i++) {
            var cell = this.getCellForParticle(particles[i]);
            cell.addParticle(particles[i]);
        }
    }

    this.guessOffset = function(px, py, cell) {
        var xOffset = 0;
        var yOffset = 0;        

        if(px < cell.left) {
            xOffset--;
        } else if (px > cell.right) {
            xOffset++;
        }

        if(py < cell.top) {
            yOffset--;
        } else if (py > cell.bottom) {
            yOffset++;
        }

        return {
            xOffset: xOffset,
            yOffset: yOffset
        };
    }

    this.updateParticlesInCells = function () {
        for (var i = 0; i < this.cells.length; i++) {
            for (var j = 0; j < this.cells[i].length; j++) {
                var cell = this.cells[i][j];
                var removed = cell.removeGoneParticles();
                for (var r = 0; r < removed.length; r++) {
                    var rp = removed[r];
                    var rpPosX = rp.position.x;
                    var rpPosY = rp.position.y;
                    var o = this.guessOffset(rpPosX, rpPosY, cell);
                    
                    o.yOffset = (i + o.yOffset) >= 0 && (i + o.yOffset) < this.rowsCount? o.yOffset: 0;
                    var yIndex = i + o.yOffset;
                    o.xOffset = (j + o.xOffset) >= 0 && (j + o.xOffset) < this.colsCount? o.xOffset: 0;
                    var xIndex = j + o.xOffset;                    
                    
                    this.cells[yIndex][xIndex].addParticle(rp);
                }                
            }
        }
    }

    this.initNeighborsForCells = function () {
        this.iterateCells(function(cell, grid) {
            var ignoreY = [cell.rowIndex - grid.cellsIgnoreRadius, cell.rowIndex + grid.cellsIgnoreRadius];
            var ignoreX = [cell.colIndex - grid.cellsIgnoreRadius, cell.colIndex + grid.cellsIgnoreRadius];
            for (var yIndex = cell.rowIndex - grid.cellsSearchRadius; yIndex < (cell.rowIndex + grid.cellsSearchRadius) && yIndex < grid.rowsCount; yIndex++) {
                for (var xIndex = cell.colIndex - grid.cellsSearchRadius; xIndex < (cell.colIndex + grid.cellsSearchRadius) && xIndex < grid.colsCount; xIndex++) {
                    if(yIndex >= 0 && xIndex >= 0) {
                        if((yIndex <= ignoreY[0] || yIndex >= ignoreY[1]) && (xIndex <= ignoreX[0] || xIndex >= ignoreX[1])) {
                            if(yIndex != cell.rowIndex || xIndex != cell.colIndex){
                                cell.neighbors.push(grid.cells[yIndex][xIndex]);
                            }
                        }
                    }
                }
            }
        });
    }

    function getNeighbors(particle) {
        var neighbors = [];
        var cell = particle.cell;
        
        for (var i = 0; i < cell.neighbors.length; i++) {
            var neighborCell = cell.neighbors[i];
            neighbors = neighbors.concat(neighborCell.particles);
        }

        return neighbors;
    }

    this.connectParticles = function() {
        for (var cr = 0; cr < this.cells.length; cr++) {
            var cellsRow = this.cells[cr];
            for (var ci = 0; ci < cellsRow.length; ci++) {
                var cell = cellsRow[ci];
                for (var i = 0; i < cell.particles.length; i++) {
                    var p = cell.particles[i];
                    p.addChilds(getNeighbors(p).slice(0, this.maxJoins));
                }
            }
        }
    }


    this.iterateCells = function(cb) {
        for (var cr = 0; cr < this.cells.length; cr++) {
            var cellsRow = this.cells[cr];
            for (var ci = 0; ci < cellsRow.length; ci++) {
                var cell = cellsRow[ci];

                cb(cell, this);
            }
        }
    }

    this.update = function() {
        this.updateParticlesInCells();
        this.connectParticles();
    }

    this.initGrid(width, height, particles);
}

var ParticleNet = function($canvas, enableDebug){
    'use strict';
  
    var darkTriangleColor = "#7A0006",
        lightTriangleColor = "#A20008",
        yearColor = "#A20008";

    var particleSpeed = 2.0;

    var context,
        width,
        height,
        center,
        particles = [],
        time = 0,
        newTime = 0,
        delta,
        i, y,
        particle;

    var grid = {};

    //for debug
    var showGrid = enableDebug || false;
    var showParticlesWithError = enableDebug || false;
    var stopOnErrors = enableDebug || false;
    var hasError = false;

    var stopOnBlur = true;
    var runLoop = true;

    this.setDebugMode = function(isDebug) {
        showGrid = isDebug;
        showParticlesWithError = isDebug;
        stopOnErrors = isDebug;
    }

    var initPauseOnInactiveTab = function() {
        var hidden, visibilityChange; 
        if (typeof document.hidden !== "undefined") {
            hidden = "hidden";
            visibilityChange = "visibilitychange";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
            visibilityChange = "msvisibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
            visibilityChange = "webkitvisibilitychange";
        }
        
        
        function handleVisibilityChange() {
            if (document[hidden]) {
                stopLoop();
            } else {
                continueLoop();
            }
        }

        if (typeof document[hidden] === "undefined") {
            console.log("This footage requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API. Will be using fallback.");
            addEvent(window, 'focus', continueLoop);
            addEvent(window, 'blur', stopLoop);
        } else {
            addEvent(document, visibilityChange, handleVisibilityChange);
        }
    }

    var init = function(){
        if(!$canvas){
            return false;
        }

        time = getCurrentTime();
        context = $canvas.getContext('2d');
        addEvent(window, 'resize', initCanvas);

        if(stopOnBlur) {
            initPauseOnInactiveTab();
        }

        initCanvas();
        loop();
    };

    var continueLoop = function() {
        if(!runLoop) {
            runLoop = true;
            loop();
        }
    }

    var stopLoop = function() {
        runLoop = false;
    }

    var loop = function(){
        if(!runLoop || stopOnErrors && hasError){
            return;
        }
        newTime = getCurrentTime();
        delta = (newTime - time) / 100;
        time = newTime;

        if(delta > 0.2){
            delta = 0.2;
        }

        update(delta);
        draw();
        getAnimationFrame(loop);
    };

    var initCanvas = function(){
        width = $canvas.width = window.innerWidth;
        height = $canvas.height = window.innerHeight;
        center = new Vector(width/2, height/2);
        var count = width * height / 7000;
        console.log("Particles: " + count);
        generateParticles(count);
        initGrid();
    };

    var initGrid = function() {
        grid = new ParticleGrid(width, height, particles, enableDebug);
    }

    var addEvent = function($el, eventType, handler) {
        if($el == null){
            return;
        }
        if ($el.addEventListener) {
            $el.addEventListener(eventType, handler, false);
        } else if ($el.attachEvent) {
            $el.attachEvent('on' + eventType, handler);
        } else {
            $el['on' + eventType] = handler;
        }
    };

    var generateParticles = function(count){
        particles = [];
        var x = 0,
            y = 0;
        for(var i = 0; i < count; i++){
            x = Math.random() * window.innerWidth;
            y = Math.random() * window.innerHeight;

            var particle = new Particle(i, x, y);
            particle.velocity.x = Math.random() -0.5;
            particle.velocity.y = Math.random() -0.5;
            particle.velocity.nor();
            particle.speed = particleSpeed;
            particles.push(particle);
        }
    };

    var draw = function(){
        context.clearRect ( 0 , 0 , width , height );
        context.lineWidth = 1.2;
        particle = {};
        for(i = 0; i < particles.length; i++){
            particle = particles[i];
            
            context.strokeStyle = 'rgba(255, 255, 255, ' + particle.linkAlpha.toPrecision(3) + ')';
            if(showParticlesWithError && particle.hasError) {
                hasError = true;
                context.fillStyle = 'red';
                context.fillRect(particle.position.x-2, particle.position.y-2, 5, 5);
            } else {
                context.beginPath();
                context.fillStyle = 'rgba(255, 255, 255, ' +particle.jointAlpha.toPrecision(3) + ')';
                context.arc(particle.position.x, particle.position.y, 2, 0, 2 * Math.PI);
                context.fill();
            } 


            for(y = 0; y < particle.childs.length; y++){
                
                context.strokeStyle = 'rgba(255, 255, 255, ' + particle.connectionsMap[particle.childs[y].id+""].toPrecision(3) + ')';
                context.beginPath();
                context.moveTo(particle.position.x, particle.position.y);
                context.lineTo(particle.childs[y].position.x, particle.childs[y].position.y);
                context.stroke();
            }
        }

        if(showGrid) {
            context.strokeStyle = 'green';
            context.fillStyle = 'rgba(255, 255, 255, 0.5)';
            grid.iterateCells(function(cell) {
                
                context.font = "10px Arial";
                context.fillText(cell.id, cell.left, cell.top + 10);
                context.rect(cell.left, cell.top, cell.width, cell.height);
                if(showParticlesWithError && cell.hasError) {
                    context.fillStyle = 'rgba(255, 0, 0, 0.2)';
                    context.fillRect(cell.left, cell.top, cell.width, cell.height);
                    context.fillStyle = 'rgba(255, 255, 255, 0.5)';
                }
            });
            context.stroke();
        }
    };

    var getAnimationFrame = function(callback){
        if(window.requestAnimationFrame){
            window.requestAnimationFrame(callback);
        } else if( window.webkitRequestAnimationFrame){
            window.webkitRequestAnimationFrame(callback);
        } else if (window.mozRequestAnimationFrame){
            window.mozRequestAnimationFrame(callback);
        } else {
            window.setTimeout(callback, 1000 / 60);
        }
    };
 
    var update = function(delta){
        for(i = 0; i < particles.length; i++){
            particles[i].update(delta);

            if(particles[i].position.x > width){
                particles[i].velocity.x *= -1;
                particles[i].position.x = width;
            }

            if(particles[i].position.x < 0){
                particles[i].velocity.x *= -1;
                particles[i].position.x = 0;
            }

            if(particles[i].position.y > height){
                particles[i].velocity.y *= -1;
                particles[i].position.y = height;
            }

            if(particles[i].position.y < 0){
                particles[i].velocity.y *= -1;
                particles[i].position.y = 0;
            }
        }
        grid.update();
    };

    var getCurrentTime = function(){
        var date = new Date();
        return date.getTime();
    };

    init();
};

$canvas = document.querySelector('.particle-net');
var net = new ParticleNet($canvas, false);