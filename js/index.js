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
    this.radius = 2;
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

    this.onLeaving = null;
};

var GridCell = function(id, rowIndex, colIndex, posLeftTop, width, height, maxJoins) {
    'use strict';

    this.isCustom = false;
    this.isSelected = false;

    this.id = id || 0;
    this.width = width || 0;
    this.height = height || 0;
    this.rowIndex = rowIndex || 0;
    this.colIndex = colIndex || 0;

    this.maxJoins = maxJoins;

    this.top = posLeftTop.y;
    this.bottom = posLeftTop.y + height;
    this.left = posLeftTop.x;
    this.right = posLeftTop.x + width;
    this.center = new Vector(this.left + this.width / 2, this.top + this.height / 2);

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

    this.removeSelfFromNeighbors = function(ignorePredicate){
        for(var i = 0; i < this.neighbors.length; i++) {
            var n = this.neighbors[i];
            n.neighbors = n.neighbors.filter(function(nn){
                if(ignorePredicate != undefined && ignorePredicate(nn)){
                    return true;
                }
                return this.id != nn.id;
            },this);
        }
    }

    this.removeGoneParticles = function() {
        var removedParticles = [];
        var savedParticles = [];
        var posX = 0;
        var posY = 0;
        var p = null;
        for(var i = 0; i < this.particles.length; i++) {
            posX = Math.round(this.particles[i].position.x);
            posY = Math.round(this.particles[i].position.y);
            
            if(posX < this.left || posX > this.right || posY < this.top || posY > this.bottom){
                this.particles[i].cell = null;
                removedParticles.push(this.particles[i]);
                if(this.particles[i].onLeaving != null) {
                    this.particles[i].onLeaving(this.particles[i]);
                }
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

var ParticleGrid = function(width, height, options) {
    'use strict';
    
    var opt = options || {};

    this.cells = [];

    this.cellFixedWidth = 32;
    this.cellFixedHeight = 32;

    this.debugMode = opt.enableDebug || false;

    this.rowsCount = 0;
    this.colsCount = 0;

    this.width = width;
    this.height = height;

    this.cellsSearchRadius = 1;
    this.cellsIgnoreRadius = 0;
    this.maxJoins = opt.maxJoins || 1;
    this.maxNeighborsToConnect = 5;
    
    this.distanceErrorThreshold = 200;

    // Extesions
    var onAfterGridCreationCb = opt.onAfterGridCreation;
    var getTrianglesPointsCb = opt.trianglesPointsFactory;
    var onRequestAdditionalNeighborsCb = opt.onRequestAdditionalNeighbors;

    this.getCellForPosition = function(x, y){
        var xIndex = Math.floor(x / this.cellFixedWidth);
        var yIndex = Math.floor(y / this.cellFixedHeight);
        return this.cells[yIndex][xIndex];
    }

    this.getCellForParticle = function (particle) {
        var xIndex = Math.floor(particle.position.x / this.cellFixedWidth);
        var yIndex = Math.floor(particle.position.y / this.cellFixedHeight);
        return this.getCellForPosition(particle.position.x, particle.position.y);
    }

    this.getTrianglesPoints = function() {
        if(getTrianglesPointsCb){
            return getTrianglesPointsCb();
        } else {
            return null;
        }
    }

    this.initGrid = function () {
        var id = 0;
        this.cells = [];
        this.rowsCount = 0;

        for(var sumHeight = 0; sumHeight < this.height; sumHeight += this.cellFixedHeight, this.rowsCount++){
            this.colsCount = 0;
            this.cells.push([]);
            for(var sumWidth = 0; sumWidth < this.width; sumWidth += this.cellFixedWidth, this.colsCount++, id++){
                var pos = new Vector(sumWidth, sumHeight);
                var h = sumHeight + this.cellFixedHeight <= this.height? this.cellFixedHeight: this.height - sumHeight;
                var w = sumWidth + this.cellFixedWidth <= this.width? this.cellFixedWidth: this.width - sumWidth;
                this.cells[this.rowsCount].push(new GridCell(id, this.rowsCount, this.colsCount, pos, w, h, this.maxJoins));
            }
        }
        
        this.initNeighborsForCells();

        if(onAfterGridCreationCb){
            onAfterGridCreationCb(this);
        }
    }

    this.addParticles = function(particleFactoryCb) {
        var particles = particleFactoryCb(this);
        console.log("Particles: " + particles.length);
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

    this.initNeighborsForCells = function (minR, maxR, shouldShuffle) {
        minR = minR || this.cellsIgnoreRadius;
        maxR = maxR || this.cellsSearchRadius;
        shouldShuffle = shouldShuffle || true;

        var shuffle = function(array) {
            var currentIndex = array.length, temporaryValue, randomIndex;
            while (0 !== currentIndex) {
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex -= 1;
                temporaryValue = array[currentIndex];
                array[currentIndex] = array[randomIndex];
                array[randomIndex] = temporaryValue;
            }
          
            return array;
        }
        this.iterateCells(function(cell, grid) {
            var neighbors = grid.getCellsNeighbors(minR, maxR, cell, grid);

            cell.neighbors = shouldShuffle? shuffle(neighbors): neighbors;
        });
    }

    this.getCellsNeighbors = function(minR, maxR, cell, grid) {
        var neighbors = [];
        var ignoreY = [cell.rowIndex - minR, cell.rowIndex + minR];
        var ignoreX = [cell.colIndex - minR, cell.colIndex + minR];
        for (var yIndex = cell.rowIndex - maxR; yIndex <= (cell.rowIndex + maxR) && yIndex < grid.rowsCount; yIndex++) {
            for (var xIndex = cell.colIndex - maxR; xIndex <= (cell.colIndex + maxR) && xIndex < grid.colsCount; xIndex++) {
                if(yIndex >= 0 && xIndex >= 0) {
                    if((yIndex < ignoreY[0] || yIndex > ignoreY[1]) || (xIndex < ignoreX[0] || xIndex > ignoreX[1])) {
                        if(yIndex != cell.rowIndex || xIndex != cell.colIndex){
                            neighbors.push(grid.cells[yIndex][xIndex]);
                        }
                    }
                }
            }
        }
        return neighbors;
    }

    function getNeighbors(particle) {
        var neighbors = [];
        var cell = particle.cell;
        
        for (var i = 0; i < cell.neighbors.length; i++) {
            var neighborCell = cell.neighbors[i];
            neighbors = neighbors.concat(neighborCell.particles.filter(function(n){
                return n.connectionsMap[particle.id+""] == null;
            }));
        }
        if(neighbors.length == 0 && onRequestAdditionalNeighborsCb != null){
            neighbors = onRequestAdditionalNeighborsCb(particle);
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
                    p.addChilds(getNeighbors(p).slice(0, cell.maxJoins));
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

    this.getAllParticles = function() {
        var all = [];
        this.iterateCells(function(cell){
            all = all.concat(cell.particles);
        });
        return all;
    }

    this.update = function() {
        this.updateParticlesInCells();
        this.connectParticles();
    }
}

var createSnowflakeParticleGrid = function(width, height, defParticleSpeed, enableDebug){
    'use strict';

    var centerOffsetX = -32; //weird
    var nodeSpeed = 0.5;
    var snowflakeMaxJoins = 5;
    var nodeCells = [];
    var upperTrianglePoints = [];
    var lowerTrianglePoints = [];

    function initSnowflakeCenterCell(grid) {
        var node = null;
        
        var centerCell = grid.getCellForPosition(grid.width / 2 + centerOffsetX, grid.height / 2);
        centerCell = formatNodeCell(centerCell, snowflakeMaxJoins, grid.getCellsNeighbors(0, 1, centerCell, grid));

        centerCell.getNode = function() {
            if(centerCell.particles.length > 0) {
                return centerCell.particles[0];
            } else {
                var neighbors = centerCell.neighbors.reduce(function(acc, val){
                    return acc.concat(val);
                }, []);
                if(neighbors.length > 0) {
                    return neighbors[0];
                } else {
                    return null;
                }
            }
        }
        
        centerCell.updateNode = function() {
            node = centerCell.getNode();

            node.speed = nodeSpeed;
            node.radius = 4;
            
            node.onLeaving = function(){
                
            }

        }

        return centerCell;
    }

    function getCellAtAngle(angle, radius, centerCell, grid){
        var x = centerCell.center.x + radius * Math.cos(angle);
        var y = centerCell.center.y + radius * Math.sin(angle);
        return grid.getCellForPosition(x, y);
    }

    function initBranchesForTierNode(grid, tierNode, tierNodeRad, radius, nRadius, maxJoins) {
        var radOffset = 2*Math.PI / 6;
        var firstBranchNode = getCellAtAngle(tierNodeRad + radOffset, radius, tierNode, grid);
        var secondBranchNode = getCellAtAngle(tierNodeRad - radOffset, radius, tierNode, grid);
        firstBranchNode = formatNodeCell(firstBranchNode, maxJoins, 
            grid.getCellsNeighbors(0, nRadius, firstBranchNode, grid),
            tierNode);

        secondBranchNode = formatNodeCell(secondBranchNode, maxJoins, 
            grid.getCellsNeighbors(0, nRadius, secondBranchNode, grid),
            tierNode);

        return [firstBranchNode, secondBranchNode];
    }

    function initTierNodes(grid, centerCell, radius, nRadius, maxJoins, prevTierNodes, perNodeCb) {
        var tiercells = [];
        var points = 6;
        for(var a = 0, i = 0; a < 2*Math.PI - 2*Math.PI/(points*2); a+=2*Math.PI/points, i++){
            var nodeCell = getCellAtAngle(a, radius, centerCell, grid);
            var prevNode = prevTierNodes.length == points? prevTierNodes[i]: prevTierNodes[0];
            nodeCell = formatNodeCell(nodeCell, maxJoins, 
                            grid.getCellsNeighbors(0, nRadius, nodeCell, grid),
                            prevNode);
            
            nodeCell.getNode = function() {
                if(nodeCell.particles.length > 0) {
                    return nodeCell.particles[0];
                } else {
                    var neighbors = nodeCell.neighbors.reduce(function(acc, val){
                        return acc.concat(val);
                    }, []);
                    if(neighbors.length > 0) {
                        return neighbors[0];
                    } else {
                        return null;
                    }
                }
            }
            tiercells.push(nodeCell);
            if(perNodeCb){
                perNodeCb(a, nodeCell);
            }
        }
        
        return tiercells;
    }

    function formatNodeCell(cell, maxJoins, selfNeighbors, foreignNode) {
        var sn = selfNeighbors || [];
        var fn = foreignNode && foreignNode.selfNeighbors || [];
        cell.neighbors.forEach(function(n){
            n.removeSelfFromNeighbors(function(nCell){
                return nCell.isCustom;
            });
        });
        cell.removeSelfFromNeighbors(function(n){
            n.removeSelfFromNeighbors(function(nCell){
                return nCell.isCustom;
            });
        });
        cell.selfNeighbors = sn;
        cell.neighbors = sn;
        cell.neighbors.forEach(function(c) {
            c.isCustom = true;
            c.maxJoins = maxJoins;
            c.neighbors = [cell];
            if(foreignNode != null) {
                c.neighbors =  c.neighbors.concat(foreignNode, fn);
            }
        });
        cell.neighbors = cell.neighbors.concat(fn);
        cell.isCustom = true;
        cell.maxJoins = maxJoins;
        return cell;
    }

    var afterCreateCb = function(grid) {
        var center = initSnowflakeCenterCell(grid);
        var tier0cells = initTierNodes(grid, center, Math.round(height / 2 * 0.2), 2, 2, [center]);
        var tier1cells = initTierNodes(grid, center, Math.round(height / 2 * 0.4), 1, 2, tier0cells);
        var tier2cells = initTierNodes(grid, center, Math.round(height / 2 * 0.6), 2, 2, tier1cells);
        
        var branches = [];
        var t2BranchesFactory = function(rad, node) {
            branches = branches.concat(initBranchesForTierNode(grid, node, rad,  Math.round(height / 2 * 0.2), 1, 1));
        }
        var tier3cells = initTierNodes(grid, center, Math.round(height / 2 * 0.8), 1, 2, tier2cells, t2BranchesFactory);
        
        var tier4cells = initTierNodes(grid, center, Math.round(height / 2 * 1.05), 2, 2, tier3cells);

        nodeCells = nodeCells.concat(center, tier2cells, tier4cells, tier3cells, tier1cells, tier0cells, branches);
        //center.neighbors = center.neighbors.concat(tier1cells);
    }

    var requestAdditionalParticles = function(particle){
        
    }

    var particlesFactory = function(grid) {
        var id = 0;

        var particles = nodeCells.map(function(v, i){
            var p = new Particle(i, v.center.x, v.center.y);
            v.nodeParticle = p;
            
            return p;
        });

        if(particles.length > 0) {
            particles[0].radius = 4;
        }

        upperTrianglePoints = [particles[0], particles[1], particles[3]];
        lowerTrianglePoints = [particles[0], particles[1], particles[5]];

        var count = width * height / 6000;
        var x = 0,
            y = 0;
        for(var i = 0; i < count; i++){
            x = Math.random() * window.innerWidth;
            y = Math.random() * window.innerHeight;

            var particle = new Particle(i, x, y);
            particle.velocity.x = Math.random() -0.5;
            particle.velocity.y = Math.random() -0.5;
            particle.velocity.nor();
            particle.speed = defParticleSpeed;
            particles.push(particle);
        }

        return particles;
    }

    var getOptions = function(enableDebug) {
        var opt = {
            onAfterGridCreation: afterCreateCb,
            trianglesPointsFactory: function(grid) {
                return [upperTrianglePoints, lowerTrianglePoints];
            },
            enableDebug: enableDebug
        }
        return opt;

    }

    var createGrid = function(width, height, enableDebug){
        var grid = new ParticleGrid(width, height, getOptions(enableDebug));
        grid.initGrid();
        grid.addParticles(particlesFactory);

        return grid;
    }

    return createGrid(width, height, enableDebug);
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

    var hidden, visibilityChange;
    var pauseOnClick = enableDebug || false;
    var stopOnBlur = true;
    var runLoop = true;

    var selectOnDbClick = enableDebug || false;
    var selectedCell = null;

    this.setDebugMode = function(isDebug) {
        showGrid = isDebug;
        showParticlesWithError = isDebug;
        stopOnErrors = isDebug;
        pauseOnClick = isDebug;
        selectOnDbClick = isDebug;
    }

    var handleVisibilityChange = function() {
        if (document[hidden]) {
            stopLoop();
        } else {
            continueLoop();
        }
    }

    var handlePauseClick = function(e){
        if(e.ctrlKey) {
            if(runLoop) {
                stopLoop();
            } else {
                continueLoop();
            }
        }
    }

    var handleSelectDbClick = function(e){
        if(selectedCell != null) {
            selectedCell.isSelected = false;
            selectedCell.neighbors.forEach(function(val) {
                val.isSelected = false;
            });
        }
        var c = grid.getCellForPosition(e.clientX, e.clientY);
        c.isSelected = true;
        c.neighbors.forEach(function(val) {
            val.isSelected = true;
        });
        selectedCell = c;
    }

    var initPauseOnInactiveTab = function() {
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

        if(selectOnDbClick) {
            addEvent(window, 'dblclick', handleSelectDbClick);
        }

        if(pauseOnClick) {
            addEvent(window, 'click', handlePauseClick);
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
        initGrid();
    };

    var initGrid = function() {
        grid = createSnowflakeParticleGrid(width, height, particleSpeed, enableDebug);
        particles = grid.getAllParticles();
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

    var draw = function(){
        context.clearRect ( 0 , 0 , width , height );
        context.lineWidth = 1.5;
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
                context.arc(particle.position.x, particle.position.y, particle.radius, 0, 2 * Math.PI);
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

        //drawTriangles(context, grid);

        if(showGrid) {
            context.strokeStyle = 'green';
            context.fillStyle = 'rgba(255, 255, 255, 0.5)';
            grid.iterateCells(function(cell) {
                
                context.font = "10px Arial";
                context.fillText(cell.id, cell.left, cell.top + 10);
                context.rect(cell.left, cell.top, cell.width, cell.height);
                if(cell.isSelected) {
                    context.fillStyle = 'rgba(0, 0, 255, 0.3)';
                    context.fillRect(cell.left, cell.top, cell.width, cell.height);
                    context.fillStyle = 'rgba(255, 255, 255, 0.5)';
                }
                if(showParticlesWithError && cell.hasError) {
                    context.fillStyle = 'rgba(255, 0, 0, 0.2)';
                    context.fillRect(cell.left, cell.top, cell.width, cell.height);
                    context.fillStyle = 'rgba(255, 255, 255, 0.5)';
                }
            });
            context.stroke();
        }
    };

    var drawTriangles = function(context, grid){
        var trianlesPoints = grid.getTrianglesPoints();
        var color = darkTriangleColor;
        if(trianlesPoints != null) {
            for (var t = 0; t < trianlesPoints.length; t++) {
                var triangle = trianlesPoints[t];
                context.beginPath();
                context.moveTo(triangle[0].position.x, triangle[0].position.y);
                context.fillStyle = color;
                for(var p = 1; p < 3; p++){
                    context.lineTo(triangle[p].position.x, triangle[p].position.y);
                }

                context.fill();

                for(var p = 0; p < 3; p++){
                    context.beginPath();
                    context.fillStyle = 'rgba(255, 255, 255, 1)';
                    context.arc(triangle[p].position.x, triangle[p].position.y, triangle[p].radius, 0, 2 * Math.PI);
                    context.fill();
                }                

                color = lightTriangleColor;
            }
        }
    }

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