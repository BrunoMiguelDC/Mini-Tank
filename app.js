import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, vec4, mult, inverse, normalMatrix, scale, add} from "../../libs/MV.js";
import {modelView, loadMatrix, multRotationY, multRotationX, multRotationZ, multScale, multTranslation, popMatrix, pushMatrix} from "../../libs/stack.js";

import * as CUBE from '../../libs/cube.js';
import * as CYLINDER from '../../libs/cylinder.js';
import * as PYRAMID from '../../libs/pyramid.js';
import * as SPHERE from '../../libs/sphere.js';
import * as TORUS from '../../libs/torus.js';
import * as PRISM from './prism.js';

const FLOOR1_COLOR = vec4(101/255, 104/255, 88/255, 1.0);
const FLOOR2_COLOR = vec4(165/255, 182/255, 93/255, 1.0);
const RIM_COLOR = vec4(27/255, 38/255, 49/255, 1.0);
const TYRE_COLOR = vec4(0.0, 0.0, 0.0, 1.0);
const AXIS_COLOR = vec4(1.0, 0.0, 0.0, 1.0);
const LOWER_BUMPERS_COLOR = vec4(9/255, 30/255, 8/255, 1.0);
const UPPER_BUMPERS_COLOR = vec4(15/255, 53/255, 13/255, 1.0);
const LOWER_BODY_COLOR = vec4(5/255, 20/255, 5/255, 1.0);   
const UPPER_BODY_COLOR = vec4(52/255, 75/255, 36/255, 1.0);
const SKY_COLOR = vec4(22/255, 46/255, 82/255, 1.0);
const CANNON_BALL_COLOR = vec4(1.0, 0.0, 0.0, 0.0);

const MOSAIC_LENGTH = 5;
const MOSAIC_WIDTH = 5;
const MOSAIC_HEIGHT = 0.5;

const FLOOR_LENGTH = 165;
const FLOOR_WIDTH = 165;



const TANK_LENGTH = 110.7;
const TANK_WIDTH = 30.4;
const TANK_HEIGHT = 23.5;

const NUM_WHEELS = 5; 
const WHEEL_SPACING = 0.2;
const TYRE_DIAMETER = 7;
const RIM_DIAMETER = TYRE_DIAMETER - TYRE_DIAMETER*0.4;
const TYRE_OUTER_DIAMETER = TYRE_DIAMETER + TYRE_DIAMETER*0.4;
const TYRE_WIDTH = 2*RIM_DIAMETER;
const AXIS_WIDTH = TANK_WIDTH - 2*(RIM_DIAMETER);
const WHEELS_DISTANCE_FROM_BODY = 1.25;
const WHEELS_DISTANCE_FROM_BUMPERS = 0.5;

const TANK_BODY_LENGTH = 90.7;
const UPPER_BODY_DISTANCE_FROM_LOWER_BODY = 6.5
const BODY_DISTANCE_FROM_GROUND = TYRE_OUTER_DIAMETER/2 - RIM_DIAMETER/2;
const UPPER_BODY_DISTANCE_FROM_TYRES = 0.7;

const LOWER_BODY = [(NUM_WHEELS*TYRE_OUTER_DIAMETER + (NUM_WHEELS-1)*WHEEL_SPACING + 2*WHEELS_DISTANCE_FROM_BUMPERS), 
                    (TYRE_OUTER_DIAMETER - BODY_DISTANCE_FROM_GROUND) + UPPER_BODY_DISTANCE_FROM_TYRES, 
                    TANK_WIDTH - 2*RIM_DIAMETER - 2*WHEELS_DISTANCE_FROM_BODY];
const UPPER_BODY = [LOWER_BODY[0]+2*UPPER_BODY_DISTANCE_FROM_LOWER_BODY, 7, LOWER_BODY[2]+2*(RIM_DIAMETER + WHEELS_DISTANCE_FROM_BODY)];


const FRONT_LOWER_BUMPER = [LOWER_BODY[1]-3.5, TANK_LENGTH - TANK_BODY_LENGTH, UPPER_BODY[2]]; 
const FRONT_UPPER_BUMPER = [UPPER_BODY[1], FRONT_LOWER_BUMPER[1]-UPPER_BODY_DISTANCE_FROM_LOWER_BODY, UPPER_BODY[2]];
    
const REAR_LOWER_BUMPER = [UPPER_BODY_DISTANCE_FROM_LOWER_BODY, 4, UPPER_BODY[2]];  
const REAR_UPPER_BUMPER = [7.5, UPPER_BODY[1], UPPER_BODY[2]];  

const CANNON_BODY = [20, TANK_HEIGHT - (UPPER_BODY[1] + LOWER_BODY[1] + BODY_DISTANCE_FROM_GROUND), 20];
const CANNON_PIPE1 = [3, CANNON_BODY[0]/2, 3];
const CANNON_PIPE2 = [CANNON_PIPE1[0]-1, 36, CANNON_PIPE1[2]-1];
const CANNON_PIPE3 = [CANNON_PIPE1[0], 4, CANNON_PIPE1[2]];

const CANNON_BALL = [(CANNON_PIPE2[0]-1)/2, (CANNON_PIPE2[0]-1)/2, (CANNON_PIPE2[0]-1)/2];
const CANNON_BALL_INITIAL_VEL = 10;
const GRAVITY_ACCELERATION = [0, -9.8, 0, 0];

const FRONT_VIEW = {
    vpDistance: 20,
    eye: [FLOOR_LENGTH/2, 0, 0],
    at: [0,0,0],
    up: [0,1,0],
};
const UPPER_VIEW = {
    vpDistance: 90,
    eye: [0, 77, 0],
    at: [0,0,0],
    up: [1,0,0], // ou [0, 0, 1]
};
const RIGHT_SIDE_VIEW = {
    vpDistance: 20,
    eye: [0, 0, -FLOOR_WIDTH/2],
    at: [0,0,0],
    up: [0,1,0],
};
const AXIONOMETRIC_PROJECTION_VIEW = {
    vpDistance: 77,
    eye: [77, 77, 77], // alterar de maneira a utilizar o vpDistance
    at: [0,0,0],
    up: [0,1,0],
    axionometric: true
};

const ZOOM_INCREMENT = 1;
const FORWARD_INCREMENT = 1;
const CANNON_ORIENTATION_INCREMENT = 1;
const CANNON_ANGLE_INCREMENT = 1;


/** @type WebGLRenderingContext */
let gl;

let speed = 1.1;     // Speed 
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let previousTime = 0.0;

let leftCannonModelView;
let rightCannonModelView;

let forward = 0.0;
let cannonOrientation = 0.0;
let cannonAngle = 0.0;

let cannonBalls = [];

let zoom = 0.0;
let view;


function setup(shaders){
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let vpDistance;
    let mProjection;
    let modelViewMatrix;
    view = RIGHT_SIDE_VIEW;
    setView(RIGHT_SIDE_VIEW);

    mode = gl.LINES; 

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function(event) {
        switch(event.key) {
            case 'W':
                mode = gl.LINES; 
                break;
            case 'S':
                mode = gl.TRIANGLES;
                break;
            case '+':
                zoom -= ZOOM_INCREMENT; // ^^
                setView(view);; //AMPLIACAO
                break;
            case '-':
                zoom += ZOOM_INCREMENT; // ^^
                setView(view);
                break;
            case 'ArrowUp':
                forward += FORWARD_INCREMENT;
                break;
            case 'ArrowDown':
                forward -= FORWARD_INCREMENT;
                break;
            case 'd':
                cannonOrientation -= CANNON_ORIENTATION_INCREMENT; 
                break;
            case 'a':  
                cannonOrientation += CANNON_ORIENTATION_INCREMENT; 
                break;
            case 'w':
                if(cannonAngle <= Math.atan((CANNON_BODY[1]/2-CANNON_PIPE1[0]/2)/(CANNON_BODY[0]/2))*180/Math.PI){
                    cannonAngle += CANNON_ANGLE_INCREMENT;
                  }      
                break;
            case 's':
                if(cannonAngle > 0) {
                    cannonAngle -= CANNON_ANGLE_INCREMENT;
                }
                break;
            case ' ':
                setCannonBalls();
                break;
            case '1': // RETIRAR CALCULO    DE mPorjection SEMPRE IGUAL
                zoom = 0.0;
                view = FRONT_VIEW;
                setView(FRONT_VIEW);
                break;
            case '2':
                zoom = 0.0;
                view = UPPER_VIEW;
                setView(UPPER_VIEW);
                break;
            case '3':
                zoom = 0.0;
                view = RIGHT_SIDE_VIEW;
                setView(RIGHT_SIDE_VIEW);
                break;
            case '4':
                zoom = 0.0;
                view = AXIONOMETRIC_PROJECTION_VIEW;
                setView(AXIONOMETRIC_PROJECTION_VIEW);
                break;
                            
        }
    }

    gl.clearColor(SKY_COLOR[0], SKY_COLOR[1], SKY_COLOR[2], SKY_COLOR[3]);
    CUBE.init(gl);
    CYLINDER.init(gl);
    PYRAMID.init(gl);
    SPHERE.init(gl);
    TORUS.init(gl);
    PRISM.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);

    function setView(view){
        let camNear = -TANK_BODY_LENGTH;
        let camFar = TANK_BODY_LENGTH;
        
        if(view.axionometric) {
            camNear = -3*view.vpDistance;
            camFar = 3*view.vpDistance;
        }
        vpDistance = view.vpDistance + zoom;
        
        mProjection = ortho(-vpDistance*aspect, vpDistance*aspect, -vpDistance, vpDistance, camNear, camFar);
        modelViewMatrix = lookAt(view.eye, view.at, view.up);
    }

    function setUniformColor(color){
        let uColorLoc = gl.getUniformLocation(program, "uColor");
        gl.uniform4fv(uColorLoc, color) ;
    }

    function setCannonBalls(){
        
        let wc1 = mult(inverse(modelViewMatrix), leftCannonModelView);
        let wc2 = mult(inverse(modelViewMatrix), rightCannonModelView);
                
        let pos0_1 = mult(wc1, [0.0, -0.5, 0, 1.0]);
        let pos0_2 = mult(wc2, [0.0, -0.5, 0, 1.0]);

        let vel0 = mult(normalMatrix(wc1), [0.0, -(speed+CANNON_BALL_INITIAL_VEL), 0.0, 0.0]);
        
        cannonBalls.push([pos0_1, pos0_2, vel0]);
    }

    function resize_canvas(event){
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = ortho(-vpDistance*aspect,vpDistance*aspect, -vpDistance, vpDistance,-TANK_WIDTH*vpDistance,TANK_WIDTH *vpDistance);
    }

    function uploadModelView(){
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }
    
    function Mosaic(x, z){ 
        
        multScale([MOSAIC_LENGTH, MOSAIC_HEIGHT, MOSAIC_WIDTH]);
    
        uploadModelView();
        
        setUniformColor(FLOOR1_COLOR);
        if((x+z)%2 == 0) {
            setUniformColor(FLOOR2_COLOR);
        }
        
        CUBE.draw(gl, program, mode);
    }

    function Floor(){
        
        let numMosaics = FLOOR_LENGTH/MOSAIC_LENGTH;
        for(let x = -(numMosaics/2 * MOSAIC_LENGTH); x < (numMosaics/2 * MOSAIC_LENGTH); x += MOSAIC_LENGTH) {
            for(let z = -(numMosaics/2 * MOSAIC_WIDTH); z < (numMosaics/2 * MOSAIC_WIDTH); z += MOSAIC_WIDTH){
                pushMatrix();
                    multTranslation([x, 0, z]);            
                    Mosaic(x, z);
                popMatrix();    
            }
        }
    }

    function Rim(){
        
        multScale([RIM_DIAMETER, RIM_DIAMETER, RIM_DIAMETER]);

        uploadModelView();
        
        setUniformColor(RIM_COLOR);
        
        SPHERE.draw(gl, program, mode);
    }

    function Tyre(){
        
        multScale([TYRE_DIAMETER, TYRE_DIAMETER, TYRE_WIDTH]);
        multRotationX(90);
        
        uploadModelView();
        
        setUniformColor(TYRE_COLOR);

        TORUS.draw(gl, program, mode);
    }

    function Wheel(){
        
        pushMatrix();
            Tyre();
        popMatrix();
        Rim();
    }
    
    function Axis(){
        
        multRotationX(90);
        multScale([2, AXIS_WIDTH, 2]);
        
        uploadModelView();
        
        setUniformColor(AXIS_COLOR);

        CYLINDER.draw(gl, program, mode);
    }

    function WheelAndAxis(){
      
        let tz = AXIS_WIDTH/2 + RIM_DIAMETER/2;
        pushMatrix();
            Axis();
        popMatrix();
        pushMatrix();
            multTranslation([0, 0, tz]);
            Wheel();
        popMatrix();
        multTranslation([0, 0, -tz]);
        Wheel();
    }

    function WheelSystem(){
        
        let halfNumWheels = Math.trunc(NUM_WHEELS/2);
        let tyreDistance = TYRE_OUTER_DIAMETER+WHEEL_SPACING;
        for(let x = -(halfNumWheels*(tyreDistance)); x <= halfNumWheels*tyreDistance; x+= tyreDistance){
            pushMatrix();
                multTranslation([x, 0, 0]);
                multRotationZ(-(forward / (TYRE_OUTER_DIAMETER/2)) * 360/(2*Math.PI));
                WheelAndAxis();
            popMatrix();
        }
    }

    function FrontBumper(){
        
        multRotationZ(-90);
        //lowerBumper
        pushMatrix();
            multScale(FRONT_LOWER_BUMPER);
    
            uploadModelView();

            setUniformColor(LOWER_BUMPERS_COLOR);
        
            PRISM.draw(gl, program, mode);
        popMatrix();

        //upperBumper
        multTranslation([-(FRONT_LOWER_BUMPER[0]/3 + FRONT_UPPER_BUMPER[0]/3), 
        2*FRONT_LOWER_BUMPER[1]/3 - 2*FRONT_UPPER_BUMPER[1]/3, 0]);
        multRotationY(180);
        multScale(FRONT_UPPER_BUMPER);
    
        uploadModelView();
        
        setUniformColor(UPPER_BUMPERS_COLOR);

        PRISM.draw(gl, program, mode);
    }

    function RearBumper(){
        
        multRotationX(180);
        multRotationY(180);
            
        //lowerBumper
        pushMatrix()
            multScale(REAR_LOWER_BUMPER);
            
            uploadModelView();
        
            setUniformColor(LOWER_BUMPERS_COLOR);

            PRISM.draw(gl, program, mode);
        popMatrix()

        //upperBumper
        multTranslation([(2*REAR_LOWER_BUMPER[0]/3+REAR_UPPER_BUMPER[0]/3),
        -(REAR_LOWER_BUMPER[1]/3+2*REAR_UPPER_BUMPER[1]/3), 0]);          
        multScale(REAR_UPPER_BUMPER);

        uploadModelView();

        setUniformColor(UPPER_BUMPERS_COLOR);

        PRISM.draw(gl, program, mode);
    }

    function CentralBody(){
        
        //LowerBody
        pushMatrix();
            multScale(LOWER_BODY);  

            uploadModelView();

            setUniformColor(LOWER_BODY_COLOR);
            
            CUBE.draw(gl, program, mode);
            
        popMatrix();
        //upperBody

        multTranslation([0, LOWER_BODY[1]/2+UPPER_BODY[1]/2, 0]);
        multScale(UPPER_BODY); 
    
        uploadModelView();

        setUniformColor(UPPER_BODY_COLOR);

        CUBE.draw(gl, program, mode);
    }
    
    function Body(){
        
        pushMatrix()
            CentralBody();
        popMatrix();
        pushMatrix()
            multTranslation([LOWER_BODY[0]/2 + FRONT_LOWER_BUMPER[1]/3, 
                LOWER_BODY[1]/2 - FRONT_LOWER_BUMPER[0]/3, 0]);
            FrontBumper();
        popMatrix();

        multTranslation([-(LOWER_BODY[0]/2 + REAR_LOWER_BUMPER[0]/3),
            LOWER_BODY[1]/2-REAR_LOWER_BUMPER[1]/3, 0]);
        RearBumper();
    }

    function CannonPipe(){

        multRotationZ(90);
        //Pipe1
        pushMatrix();
            multScale(CANNON_PIPE1);

            uploadModelView();
        
            setUniformColor(LOWER_BODY_COLOR);

            CYLINDER.draw(gl, program, mode);
        
        popMatrix()
        //Pipe2
        pushMatrix();
            multTranslation([0,-(CANNON_PIPE1[1]/2 + CANNON_PIPE2[1]/2),0]);
            multScale(CANNON_PIPE2);

            uploadModelView();
    
            setUniformColor(UPPER_BUMPERS_COLOR);

            CYLINDER.draw(gl, program, mode);
        popMatrix();
        //Pipe3
        multTranslation([0,-(CANNON_PIPE1[1]/2 + CANNON_PIPE2[1] + CANNON_PIPE3[1]/2),0]);
        multScale(CANNON_PIPE3);
        
        uploadModelView();

        setUniformColor(LOWER_BODY_COLOR);

        CYLINDER.draw(gl, program, mode);     
    }
    
    function MainCannon(){
        
        pushMatrix();
            multScale(CANNON_BODY);  

            uploadModelView();

            setUniformColor(LOWER_BUMPERS_COLOR);

            CYLINDER.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multRotationZ(cannonAngle);
            multTranslation([CANNON_BODY[0]/1.7, 0, CANNON_BODY[2]/5]);
            multScale([0.5, 0.5, 0.5]);  

            CannonPipe();
            leftCannonModelView = modelView();
        popMatrix()

        multRotationZ(cannonAngle);
        multTranslation([CANNON_BODY[0]/1.7, 0, -CANNON_BODY[2]/5]);
        multScale([0.5, 0.5, 0.5]);  
        
        CannonPipe();
        rightCannonModelView = modelView();
    }

    function Cannon(){

        pushMatrix()
            MainCannon();
        popMatrix();

        multTranslation([0,CANNON_BODY[1]/2,0]);
        multScale(CANNON_BODY);  

        uploadModelView();

        setUniformColor(UPPER_BUMPERS_COLOR);

        SPHERE.draw(gl, program, mode);
    }

    function Tank(){
        
        pushMatrix();
            multTranslation([0, TYRE_OUTER_DIAMETER/2, 0]);
            WheelSystem();
        popMatrix();
        pushMatrix();
            multTranslation([0, LOWER_BODY[1]/2 + BODY_DISTANCE_FROM_GROUND, 0]);
            Body();
        popMatrix();

        multTranslation([0, UPPER_BODY[1] + LOWER_BODY[1] + BODY_DISTANCE_FROM_GROUND + CANNON_BODY[1]/2, 0]);
        multRotationY(cannonOrientation);
        
        Cannon();
    }


    function CannonBall(index, deltaTime){
        
        let cannonBall = cannonBalls[index];
        
        //left cannon ball
        pushMatrix();
            multTranslation([cannonBall[0][0], cannonBall[0][1], cannonBall[0][2]]);
            multScale(CANNON_BALL);

            uploadModelView();

            setUniformColor(CANNON_BALL_COLOR);

            SPHERE.draw(gl, program, mode);
        popMatrix();
        
        //right cannon ball
        multTranslation([cannonBall[1][0], cannonBall[1][1], cannonBall[1][2]]);
        multScale(CANNON_BALL);

        uploadModelView();

        SPHERE.draw(gl, program, mode);

        //new position for left cannon ball
        cannonBall[0] = add(add(cannonBall[0], scale((speed*deltaTime), cannonBall[2])), scale(0.5, scale((speed*deltaTime)**2.0, GRAVITY_ACCELERATION)));
        
        //new position for right cannon ball
        cannonBall[1] = add(add(cannonBall[1], scale((speed*deltaTime), cannonBall[2])), scale(0.5, scale((speed*deltaTime)**2.0, GRAVITY_ACCELERATION)));

        //new velocity for the two cannon balls
        cannonBall[2] = add(cannonBall[2], scale((speed*deltaTime), GRAVITY_ACCELERATION));

        if(cannonBall[0][1] <= CANNON_BALL[1]/2){
            cannonBalls.splice(index, 1);
        }
    }

    function render(currentTime){
        currentTime *= 0.001;
        let deltaTime = currentTime - previousTime;
        previousTime = currentTime;
        
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    
        loadMatrix(modelViewMatrix);

        pushMatrix();
            multTranslation([0, -MOSAIC_HEIGHT/2, 0]);
            Floor();
        popMatrix();
        pushMatrix();
            multTranslation([forward, 0, 0]);
            multScale([0.5, 0.5, 0.5]);
            Tank();
        popMatrix();
        if(cannonBalls.length > 0) {
            for(let i = 0; i < cannonBalls.length; i++){
                pushMatrix();
                    CannonBall(i, deltaTime);
                popMatrix();
            }
        } 
    }

}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
