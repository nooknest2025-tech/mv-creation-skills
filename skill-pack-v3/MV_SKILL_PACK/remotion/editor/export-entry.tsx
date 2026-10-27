import React from 'react';
import {registerRoot,Composition,useCurrentFrame,useVideoConfig,Audio,staticFile} from 'remotion';
import {Scene} from './editor-scene';
function Film({data}:any){const {fps}=useVideoConfig();const t=useCurrentFrame()/fps;return <><link rel="stylesheet" href={staticFile('editor.css')}/><link rel="stylesheet" href={staticFile('font-options.css')}/><Scene data={data} t={t} base={staticFile('')}/><Audio src={staticFile(data.audioFile)}/></>}
registerRoot(()=> <Composition id="EditableMV" component={Film} width={1280} height={720} fps={24} durationInFrames={24} defaultProps={{data:{duration:1,fps:24,width:1280,height:720,scenes:[],lyrics:[],assets:[],audioFile:''}}} calculateMetadata={({props}:any)=>({width:props.data.width,height:props.data.height,fps:props.data.fps,durationInFrames:Math.ceil(props.data.duration*props.data.fps)})}/>);
