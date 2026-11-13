import React from 'react';
import {registerRoot,Composition,useCurrentFrame,useVideoConfig,Audio,staticFile,OffthreadVideo,Freeze} from 'remotion';
import {Scene} from './editor-scene';
import {Video as MediaVideo} from '@remotion/media';
// Video clips: the frame shown is exactly clipPlan/clipSourceTime (same as the editor preview) via <Freeze>.
// Clips are ALWAYS muted; the song is muxed afterwards from the original file by export.mjs (never time-stretched).
function Film({data,videoDecoders={}}:any){const {fps}=useVideoConfig();const t=useCurrentFrame()/fps;
 const base=staticFile('');
 const video=(src:string,srcTime:number,style:any,key:any)=><Freeze key={key} frame={Math.max(0,Math.round(srcTime*fps))}>{videoDecoders[src.slice(base.length)]==='webcodecs'?<MediaVideo src={src} muted volume={0} objectFit={style.objectFit??'cover'} style={{...style,objectFit:undefined}} onError={error=>{console.warn('動画は従来方式で書き出します: '+error.message);return 'fallback'}}/>:<OffthreadVideo src={src} muted volume={0} style={style}/>}</Freeze>;
 return <><link rel="stylesheet" href={staticFile('editor.css')}/><link rel="stylesheet" href={staticFile('font-options.css')}/><Scene data={data} t={t} base={staticFile('')} video={video}/><Audio src={staticFile(data.audioFile)}/></>}
registerRoot(()=> <Composition id="EditableMV" component={Film} width={1280} height={720} fps={24} durationInFrames={24} defaultProps={{data:{duration:1,fps:24,width:1280,height:720,scenes:[],lyrics:[],assets:[],audioFile:''}}} calculateMetadata={({props}:any)=>({width:props.data.width,height:props.data.height,fps:props.data.fps,durationInFrames:Math.ceil(props.data.duration*props.data.fps)})}/>);
