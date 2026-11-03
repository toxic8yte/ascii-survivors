using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private async Task RenderBenchmarks(string directory)
    {
        try
        {
            Directory.CreateDirectory(directory);DisplayServer.WindowSetVsyncMode(DisplayServer.VSyncMode.Disabled);DisplayServer.WindowSetSize(new(1920,1080));
            var rows=new List<object>();
            foreach(bool dense in new[]{false,true})foreach(int count in new[]{1000,5000,10000})
            {
                CloseOverlay();game=Benchmarks.Scene(content,count,dense,false);game.Status=RunStatus.Paused;renderer.Game=game;renderer.Camera=game.Player.Pos;RefreshHud(true);
                for(int i=0;i<12;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);
                var frames=new List<double>();double draw=0;
                for(int i=0;i<48;i++){await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);frames.Add(GetProcessDeltaTime()*1000);draw+=renderer.LastDrawMs;}
                frames.Sort();rows.Add(new{renderer=renderer.UseGlyphBatch?"atlas":"text",count,dense,frameMs=frames.Average(),p95Ms=frames[(int)(frames.Count*.95)],drawCpuMs=draw/48,visible=renderer.VisibleEnemies,drawn=renderer.RenderedEnemies,glyphs=renderer.BatchedGlyphs,packets=renderer.GlyphDrawCalls});
                if(game.Enemies.Count!=count||renderer.VisibleEnemies<renderer.RenderedEnemies)throw new InvalidOperationException("Render benchmark lost enemies");
                GD.Print($"RENDER {count} {(dense?"dense":"spread")}: {frames.Average():0.00} ms/frame, draw CPU {draw/48:0.00} ms; {renderer.VisibleEnemies} visible, {renderer.RenderedEnemies} stamps");
            }
            // Identical seed and 300 physics ticks give both renderers the same frozen arsenal snapshot.
            CloseOverlay();game=Benchmarks.Scene(content,6000,true,true,true);
            for(int i=0;i<300;i++)game.Tick(1/60f);
            game.Status=RunStatus.Paused;renderer.Game=game;renderer.Camera=game.Player.Pos;RefreshHud(true);
            for(int i=0;i<60;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);
            var frozen=new List<double>();double frozenDraw=0;long previous=System.Diagnostics.Stopwatch.GetTimestamp();
            for(int i=0;i<240;i++)
            {
                await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);long now=System.Diagnostics.Stopwatch.GetTimestamp();
                frozen.Add(System.Diagnostics.Stopwatch.GetElapsedTime(previous,now).TotalMilliseconds);previous=now;frozenDraw+=renderer.LastDrawMs;
            }
            frozen.Sort();rows.Add(new{renderer=renderer.UseGlyphBatch?"atlas":"text",frozen=true,count=game.Enemies.Count,arsenal=true,mixed=true,steps=game.Steps,frameMs=frozen.Average(),p95Ms=frozen[(int)(frozen.Count*.95)],drawCpuMs=frozenDraw/240,visible=renderer.VisibleEnemies,drawn=renderer.RenderedEnemies,glyphs=renderer.BatchedGlyphs,packets=renderer.GlyphDrawCalls});
            GD.Print($"FROZEN {game.Enemies.Count}: {frozen.Average():0.00} ms/frame, draw CPU {frozenDraw/240:0.00} ms, {renderer.BatchedGlyphs} glyphs / {renderer.GlyphDrawCalls} packets");
            await ToSignal(RenderingServer.Singleton,RenderingServer.SignalName.FramePostDraw);using(var snapshot=GetViewport().GetTexture().GetImage())snapshot.SavePng(Path.Combine(directory,"frozen-crowd.png"));
            CloseOverlay();game=Benchmarks.Scene(content,6000,true,true,true);
            for(int i=0;i<300;i++)game.Tick(1/60f);
            game.Status=RunStatus.Paused;renderer.Game=game;renderer.Camera=game.Player.Pos;RefreshHud(true);
            for(int i=0;i<60;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);
            var live=new List<double>();double liveDraw=0;float startTime=game.Time;game.Status=RunStatus.Running;
            long liveStart=System.Diagnostics.Stopwatch.GetTimestamp();previous=liveStart;
            while(game.Time-startTime<15)
            {
                await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);long now=System.Diagnostics.Stopwatch.GetTimestamp();
                live.Add(System.Diagnostics.Stopwatch.GetElapsedTime(previous,now).TotalMilliseconds);previous=now;liveDraw+=renderer.LastDrawMs;
                if(System.Diagnostics.Stopwatch.GetElapsedTime(liveStart).TotalSeconds>45)throw new TimeoutException("Live benchmark cannot complete 15 simulation seconds within 45 wall seconds");
            }
            live.Sort();rows.Add(new{renderer=renderer.UseGlyphBatch?"atlas":"text",live=true,count=game.Enemies.Count,arsenal=true,mixed=true,samples=live.Count,startTime,simulatedSeconds=game.Time-startTime,wallSeconds=System.Diagnostics.Stopwatch.GetElapsedTime(liveStart).TotalSeconds,frameMs=live.Average(),p95Ms=live[(int)(live.Count*.95)],drawCpuMs=liveDraw/live.Count,visible=renderer.VisibleEnemies,drawn=renderer.RenderedEnemies,glyphs=renderer.BatchedGlyphs,packets=renderer.GlyphDrawCalls});
            if(game.Enemies.Count!=6000)throw new InvalidOperationException("Live benchmark lost enemies");
            GD.Print($"LIVE {game.Enemies.Count} all weapons: {live.Average():0.00} ms/frame, p95 {live[(int)(live.Count*.95)]:0.00}; {game.Time-startTime:0.00} simulated seconds");
            await ToSignal(RenderingServer.Singleton,RenderingServer.SignalName.FramePostDraw);using(var snapshot=GetViewport().GetTexture().GetImage())snapshot.SavePng(Path.Combine(directory,"live-crowd.png"));
            File.WriteAllText(Path.Combine(directory,"render.json"),System.Text.Json.JsonSerializer.Serialize(rows,new System.Text.Json.JsonSerializerOptions{WriteIndented=true}));GetTree().Quit();
        }
        catch(Exception e){GD.PushError(e.ToString());GetTree().Quit(1);}
    }
}
