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
    this.childs = [];
    this.linked = false;
    this.distance = false;
    this.alpha = 0.3;
    this.hasError = false;


    this.cell = null;
    
    this.jointAlpha = this.alpha;
    this.linkAlpha = this.alpha;

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
        this.jointAlpha = this.alpha;
        this.linkAlpha = this.alpha;
    }

    this.addChild = function(link){
        for(i = 0; i < this.childs.length; i++){
            if(this.childs[i] === link){
                return false;
            }
        }
        this.childs.push(link);
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

var ParticleGrid = function(width, height, particles) {
    'use strict';
    
    var cells = [];

    var cellFixedWidth = 32;
    var cellFixedHeight = 32;

    

    var rowsCount = 0;
    var colsCount = 0;

    var cellsSearchRadius = 1;
    var maxJoins = 10;
    
    var distanceErrorThreshold = 200;

    function getCellForParticle(particle) {
        var xIndex = Math.floor(particle.position.x / cellFixedWidth);
        var yIndex = Math.floor(particle.position.y / cellFixedHeight);
        return cells[yIndex][xIndex];
    }
    
    function initGrid(width, height, particles) {
        var id = 0;
        cells = [];
        rowsCount = 0;
        
        for(var sumHeight = 0; sumHeight < height; sumHeight += cellFixedHeight, rowsCount++){
            colsCount = 0;
            cells.push([]);
            for(var sumWidth = 0; sumWidth < width; sumWidth += cellFixedWidth, colsCount++, id++){
                var pos = new Vector(sumWidth, sumHeight);
                var h = sumHeight + cellFixedHeight <= height? cellFixedHeight: height - sumHeight;
                var w = sumWidth + cellFixedWidth <= width? cellFixedWidth: width - sumWidth;
                cells[rowsCount].push(new GridCell(id, rowsCount, colsCount, pos, w, h));
            }
        }
        
        for(var i = 0; i < particles.length; i++) {
            var cell = getCellForParticle(particles[i]);
            cell.addParticle(particles[i]);
        }
    }

    function guessOffset(px, py, cell) {
        var xOffset = 0;
        var yOffset = 0;        

        if(px < cell.left) {
            xOffset--;
        } else if (px > cell.right) {
            xOffset++;
        }

        if(py < cell.top) {
            yOffset--;
        } else if (px > cell.bottom) {
            yOffset++;
        }

        return {
            xOffset: xOffset,
            yOffset: yOffset
        };
    }

    function updateParticlesInCells() {
        for (var i = 0; i < cells.length; i++) {
            for (var j = 0; j < cells[i].length; j++) {
                var cell = cells[i][j];
                var removed = cell.removeGoneParticles();
                for (var r = 0; r < removed.length; r++) {
                    var rp = removed[r];
                    var rpPosX = rp.position.x;
                    var rpPosY = rp.position.y;
                    var o = guessOffset(rpPosX, rpPosY, cell);
                    
                    if((i + o.yOffset) < rowsCount || (j + o.xOffset) < colsCount) {

                    }

                    o.yOffset = (i + o.yOffset) >= 0 && (i + o.yOffset) < rowsCount? o.yOffset: 0;
                    var yIndex = i + o.yOffset;
                    o.xOffset = (j + o.xOffset) >= 0 && (j + o.xOffset) < colsCount? o.xOffset: 0;
                    var xIndex = j + o.xOffset;                    
                    
                    cells[yIndex][xIndex].addParticle(rp);
                }                
            }
            var cellsRow = cells[i];
        }
    }

    function getNeighbors(particle) {
        var neighbors = [];
        var nCells = [];
        var cell = particle.cell;        
        for (var yIndex = cell.rowIndex - cellsSearchRadius; yIndex < (cell.rowIndex + cellsSearchRadius) && yIndex < rowsCount; yIndex++) {
            for (var xIndex = cell.colIndex - cellsSearchRadius; xIndex < (cell.colIndex + cellsSearchRadius) && xIndex < colsCount; xIndex++) {
                if(yIndex >= 0 && xIndex >= 0) {
                    var p = cells[yIndex][xIndex].particles;
                    nCells.push({y: yIndex, x: xIndex, id: cells[yIndex][xIndex].id});
                    neighbors = neighbors.concat(p.filter(function(val){
                        return val != particle;
                    }));

                    for (var t = 0; t < neighbors.length; t++) {
                        var n = neighbors[t];
                        if(particle.position.distance(n.position) > distanceErrorThreshold) {
                            particle.riseError();
                            n.riseError();
                            console.log("Distance error", particle, n);
                        }
                    }
                }
            }
        }

        return neighbors;
    }

    function connectParticles() {
        for (var cr = 0; cr < cells.length; cr++) {
            var cellsRow = cells[cr];
            for (var ci = 0; ci < cellsRow.length; ci++) {
                var cell = cellsRow[ci];
                for (var i = 0; i < cell.particles.length; i++) {
                    var p = cell.particles[i];
                    if(p.cell !== cell) throw "Incorrect cell";
                    var neighbors = getNeighbors(p);
                    p.childs = neighbors.slice(0, maxJoins - 1);
                }
            }
        }
    }

    this.iterateCells = function(cb) {
        for (var cr = 0; cr < cells.length; cr++) {
            var cellsRow = cells[cr];
            for (var ci = 0; ci < cellsRow.length; ci++) {
                var cell = cellsRow[ci];

                cb(cell);
            }
        }
    }

    this.update = function() {
        updateParticlesInCells();
        connectParticles();
    }

    initGrid(width, height, particles);
}

var ParticleNet = function($canvas){
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
    var showGrid = true;
    var showParticlesWithError = true;
    var stopOnErrors = true;
    var hasError = false;


    var init = function(){
        if(!$canvas){
            return false;
        }

        time = getCurrentTime();
        context = $canvas.getContext('2d');

        addEvent(window, 'resize', initCanvas);

        initCanvas();
        initGrid();
        loop();
    };

    var loop = function(){
        if(stopOnErrors && hasError){
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
        var count = width * height / 5000;
        console.log("Particles: " + count);
        generateParticles(count);
    };

    var initGrid = function() {
        grid = new ParticleGrid(width, height, particles)
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
        context.lineWidth = 1;
        particle = {};
        for(i = 0; i < particles.length; i++){
            particle = particles[i];
            
            context.strokeStyle = 'rgba(255, 255, 255, ' + particle.linkAlpha.toPrecision(3) + ')';
            if(showParticlesWithError && particle.hasError) {
                hasError = true;
                context.fillStyle = 'red';
                context.fillRect(particle.position.x-2, particle.position.y-2, 5, 5);
            } else {
                context.fillStyle = 'rgba(255, 255, 255, ' +particle.jointAlpha.toPrecision(3) + ')';
                context.fillRect(particle.position.x-1, particle.position.y-1, 3, 3);
            }
            
            
            context.fillRect(particle.position.x-1, particle.position.y-1, 3, 3);


            for(y = 0; y < particle.childs.length; y++){
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

            // for(var y = i + 1; y < particles.length; y++){
            //     var other = particles;
            //     getDistance(particles[i], other[y], particleRadius, particleRadiusMin);
              
                
            // }
        }
        grid.update();
    };
  
    // var getDistance = function(p1, p2, rmax, rmin){
        
    //     var distance = p1.position.distance(p2.position);

    //     if(distance <= rmax && distance >= rmin) {
    //         if (p1.childs.length >= maxjoints) return;
    //         p1.addChild(p2);

    //         p1.linkAlpha += 0.01;
    //         p1.jointAlpha += 0.02;

    //     } else {
    //         p1.removeChild(p2);
    //     }
    // }

    var getCurrentTime = function(){
        var date = new Date();
        return date.getTime();
    };

    init();
};



$canvas = document.querySelector('.particle-net');
new ParticleNet($canvas);