precision highp float;

uniform vec4 uColor;

varying vec3 fNormal;

void main() {
    //vec3 c = fNormal + vec3(1.0, 1.0, 1.0);
    //gl_FragColor = vec4(0.5*c, 1.0);
    
    //gl_FragColor = uColor;
    gl_FragColor = vec4(uColor.xyz + fNormal*uColor.xyz*0.1, 1.0);
}   