import React from 'react';
import {registerRoot,Composition,useCurrentFrame,useVideoConfig,Audio,staticFile,OffthreadVideo,Sequence,Loop} from 'remotion';
import {Scene} from './editor-scene';
// Video clips: each scene plays its clip from the scene start (muted; the song is the only audio). Short clips loop.
function Film({data}:any){const {fps}=useVideoConfig();const t=useCurrentFrame()/fps;
 const video=(src:string,start:number,_local:number,style:any,key:any)=>{const asset=data.assets.find((a:any)=>staticFile(a.src??a)===src);const len=Math.max(1,Math.round((asset?.duration??data.duration)*fps));
  return <Sequence key={key} from={Math.round(start*fps)} layout="none"><Loop durationInFrames={len} layout="none"><OffthreadVideo src={src} muted style={style}/></Loop></Sequence>};
 return <><link rel="stylesheet" href={staticFile('editor.css')}/><link rel="stylesheet" href={staticFile('font-options.css')}/><Scene data={data} t={t} base={staticFile('')} video={video}/><Audio src={staticFile(data.audioFile)}/></>}
registerRoot(()=> <Composition id="EditableMV" component={Film} width={1280} height={720} fps={24} durationInFrames={24} defaultProps={{data:{duration:1,fps:24,width:1280,height:720,scenes:[],lyrics:[],assets:[],audioFile:''}}} calculateMetadata={({props}:any)=>({width:props.data.width,height:props.data.height,fps:props.data.fps,durationInFrames:Math.ceil(props.data.duration*props.data.fps)})}/>);
