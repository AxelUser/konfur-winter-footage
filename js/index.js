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

var Particle = function(x, y){
    this.position = new Vector(x, y);
    this.velocity = new Vector();
    this.speed = 0;
    this.childs = [];
    this.linked = false;
    this.distance = false;
    this.alpha = 0.3;

    this.jointAlpha = this.alpha;
    this.linkAlpha = this.alpha;

    var acceleration = new Vector(),
        i = 0;

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



var ParticleNet = function($canvas){
    'use strict';
  
    var darkTriangleColor = "#7A0006",
        lightTriangleColor = "#A20008",
        yearColor = "#A20008";

    var particleSpeed = 2.0,
        ctimermax = 300,
        particleRadius = 100,
        particleRadiusMin = 30,
        maxjoints = 5;

    var context,
        width,
        height,
        center,
        particles = [],
        cparticle,
        time = 0,
        newTime = 0,
        ctimer = ctimermax,
        delta,
        i, y,
        particle;

    var init = function(){
        if(!$canvas){
            return false;
        }

        time = getCurrentTime();
        context = $canvas.getContext('2d');

        addEvent(window, 'resize', initCanvas);

        initCanvas();
        loop();
    };

    var loop = function(){
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
    };

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

            var particle = new Particle(x, y);
            particle.velocity.x = Math.random() -0.5;
            particle.velocity.y = Math.random() -0.5;
            particle.velocity.nor();
            particle.speed = particleSpeed;
            particles.push(particle);
        }
      
        cparticle = new Particle(center.x, center.y);
        cparticle.addChild(particles[0]);
        cparticle.addChild(particles[1]);
        cparticle.addChild(particles[2]);
    };

    var draw = function(){
        context.clearRect ( 0 , 0 , width , height );
        context.lineWidth = 1;
        particle = {};
        for(i = 0; i < particles.length; i++){
            particle = particles[i];
            context.fillStyle = 'rgba(255, 255, 255, ' +particle.jointAlpha.toPrecision(3) + ')';
            context.strokeStyle = 'rgba(255, 255, 255, ' + particle.linkAlpha.toPrecision(3) + ')';
            context.fillRect(particle.position.x-1, particle.position.y-1, 3, 3);


            for(y = 0; y < particle.childs.length; y++){
                context.beginPath();
                context.moveTo(particle.position.x, particle.position.y);
                context.lineTo(particle.childs[y].position.x, particle.childs[y].position.y);
                context.stroke();
            }
        }
        
        context.fillStyle = lightTriangleColor;//'';
        context.beginPath();
        context.moveTo(cparticle.childs[0].position.x, cparticle.childs[0].position.y);
        if (cparticle.childs[1]) context.lineTo(cparticle.childs[1].position.x, cparticle.childs[1].position.y);
        if (cparticle.childs[2]) context.lineTo(cparticle.childs[2].position.x, cparticle.childs[2].position.y);
        context.fill();
      
        context.fillStyle = darkTriangleColor; //'#';
        context.beginPath();
        context.moveTo(cparticle.childs[0].position.x, cparticle.childs[0].position.y);
        if (cparticle.childs[1]) context.lineTo(cparticle.childs[1].position.x, cparticle.childs[1].position.y);
        if (cparticle.childs[3]) context.lineTo(cparticle.childs[3].position.x, cparticle.childs[3].position.y);
        context.fill();
      

      
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
      ctimer += 1;
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

            for(var y = i + 1; y < particles.length; y++){
                var other = particles;
                getDistance(particles[i], other[y], particleRadius, particleRadiusMin);
              
                
            }
            if (ctimer > ctimermax) {
              //testCentral(cparticle, particles[i], particleRadius*2, particleRadiusMin*4);
              testCentral(cparticle, particles[i], height/3, height/5 );
            }

        }
        if (ctimer > ctimermax) { ctimer = 0; }
        
    };

    var testCentral = function(c, p, rmax, rmin) {
        var distance = c.position.distance(p.position);
        if(distance <= rmax && distance >= rmin) {
            if (p.position.y < c.position.y) {
                if (p.position.x < c.position.x) {
                    c.childs[2] = p;
                } else {
                    c.childs[0] = p;
                }
            } else {
                if (p.position.x > c.position.x) {
                    c.childs[1] = p;
                } else {
                    c.childs[3] = p;
                }
            }
        }
    }
  
    var getDistance = function(p1, p2, rmax, rmin){
        
        var distance = p1.position.distance(p2.position);

        if(distance <= rmax && distance >= rmin) {
            p1.linked = true;
            p2.linked = true;
            if (p1.childs.length >= maxjoints) return;
            p1.addChild(p2);

            p1.linkAlpha += 0.01;
            p1.jointAlpha += 0.02;

        } else {
            p1.linked = false;
            p2.linked = false;
            p1.removeChild(p2);
        }
    }

    var getCurrentTime = function(){
        var date = new Date();
        return date.getTime();
    };

    init();
};



$canvas = document.querySelector('.particle-net');
new ParticleNet($canvas);