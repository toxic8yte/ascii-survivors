using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private async Task SmokeTest(string directory)
    {
        try
        {
            Directory.CreateDirectory(directory);
            async Task Settle(){for(int i=0;i<6;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);}
            async Task Shot(string name){await Settle();await ToSignal(RenderingServer.Singleton,RenderingServer.SignalName.FramePostDraw);using var image=GetViewport().GetTexture().GetImage();if(image.IsEmpty())throw new Exception("Empty viewport capture");if(image.SavePng(Path.Combine(directory,name+".png"))!=Error.Ok)throw new IOException("Screenshot failed");}
            void Assert(bool ok,string message){if(!ok)throw new Exception(message);}
            Button FindButton(string name)=>overlay.FindChildren(name,"Button",true,false).Cast<Button>().Single();
            void Press(string name)=>FindButton(name).EmitSignal(Godot.Button.SignalName.Pressed);
            await Shot("01-title");Assert(overlayKind=="intro"&&!overlay.FindChildren("HeroGrid","",true,false).Any(),"Title separate from hero selection");
            Press("Recipes");Assert(overlayKind=="shop","Locked collection opens Legacy");CloseAux();Assert(overlayKind=="intro","Legacy returns to title");
            Press("Play");await Shot("01-heroes");Assert(overlayKind=="characters"&&overlay.FindChildren("Hero-*","Button",true,false).Count==30,"All hero portrait tiles");
            string locked=content.Heroes.Keys.First(id=>!store.Profile.Heroes.Contains(id));Press("Hero-"+locked);Assert(FindButton("ChooseStage").Disabled&&FindButton("BuyHero").Visible,"Locked hero cannot start");
            Press("Hero-hunter");Press("ChooseStage");await Shot("01-stages");Assert(overlayKind=="stages","Separate stage selection");
            Press("Stage-graveyard");Assert(edit.Map=="graveyard","Stage tile selects map");CloseAux();Assert(overlayKind=="characters","Stage back returns to heroes");CloseAux();Assert(overlayKind=="intro","Hero back returns to title");
            ShowLab();await Shot("01-laboratory");Press("Sandbox");CloseAux();Assert(overlayKind=="lab","Sandbox back returns to lab");
            Press("StressSetup");await Shot("01-stress-setup");edit.Hero=locked;int bank=store.Profile.Gold;Press("StartStress");Assert(game.Options.Stress&&game.Invincible,"Stress mode reachable with locked hero");
            ShowIntro();Press("Play");Assert(!edit.Stress&&!edit.Sandbox&&store.Profile.Heroes.Contains(edit.Hero)&&store.Profile.Gold==bank,"Play clears test mode without unlocking or spending");
            Press("ChooseStage");Press("Stage-forest");Press("StartRun");Assert(game.Status==RunStatus.Running&&game.MapId=="forest"&&!game.IsTest,"Title to heroes to stage starts normal run");game.Status=RunStatus.Paused;
            for(int i=0;i<35;i++)game.Spawn(i%4==0?"pumpkin":"skeleton",game.Player.Pos+World.Direction(i*.73f)*(160+i*9));
            game.RebuildGrid();game.Cast(game.SelectedWeapon);RefreshHud(true);await Shot("02-arena");
            game.Status=RunStatus.Running;game.GainXp(10);game.CheckLevel();game.Status=RunStatus.Upgrading;ShowChoices(false);await Settle();
            Assert(!confirmChoice!.Visible||confirmChoice.Disabled,"No accidental default selection");
            SelectChoice(0);Assert(!confirmChoice.Disabled&&game.OfferSelection==0,"Explicit selection");
            _Input(new InputEventKey{Keycode=Key.Space,Pressed=true});Assert(game.Status==RunStatus.Upgrading,"Space does not confirm");
            await Shot("03-upgrades");Assert(confirmChoice.GetGlobalRect().End.Y<=root.Size.Y+1,"Choice actions fit viewport");
            game.Choose(0);CloseOverlay();game.Status=RunStatus.Running;ShowPause();await Shot("04-pause");Assert(centeredBody!.Size.X<=540,"Pause buttons stay compact");
            string runId=game.RunId;ShowIntro();Assert(store.SavedRun?.RunId==runId,"Title preserves current battle");Press("Continue");Assert(game.RunId==runId&&game.Status==RunStatus.Running,"Continue resumes same battle");
            MakeReady();ShowShop();await Shot("05-legacy");
            edit.Sandbox=true;MakeReady();OpenSandbox();await Shot("06-sandbox-settings");
            edit.Hero="hunter";edit.Enemy="lichLord";edit.Weapon="lightning";edit.Rank=4;edit.Invulnerable=false;StartNew();game.Status=RunStatus.Paused;game.Manual=true;game.Player.Hp=game.Player.MaxHp=1000;
            var boss=game.Enemies.First(e=>e.Def.Boss);boss.SkillClock=0;game.Status=RunStatus.Running;for(int i=0;i<240&&game.Status==RunStatus.Running;i++)game.Tick(1/60f);game.Status=RunStatus.Paused;game.Cast("lightning");renderer.HighlightedWeapon="lightning";RefreshHud(true);await Shot("07-boss-ring");Assert(game.Combat.Hurt>0,"Sandbox boss deals damage");
            ShowBestiary();await Shot("08-bestiary");ShowRecipes();await Shot("09-necronomicon");ShowMap();await Shot("10-map");
            foreach(string weapon in new[]{"needle","garlic"})
            {
                edit.Weapon=weapon;edit.Enemy="dummy";edit.Evolved=false;edit.Manual=false;edit.Rank=2;StartNew();game.Clocks[weapon]=1000;
                game.Cast(weapon);for(int i=0;i<8;i++)game.Tick(1/60f);game.Status=RunStatus.Paused;renderer.HighlightedWeapon=null;await Shot("weapon-"+weapon+"-auto");
                if(weapon=="garlic")
                {game.Elapsed+=.7;await Shot("weapon-garlic-rotation");game.Manual=true;game.Cast("garlic");RefreshHud(true);await Shot("weapon-garlic-manual");}
            }
            edit.Sandbox=false;edit.Weapon="starter";MakeReady();game.Start();game.Status=RunStatus.Upgrading;game.Offers=["gauntlets","flamethrower","area"];DisplayServer.WindowSetSize(new(960,640));ShowChoices(false);SelectChoice(0);await Shot("11-small-window");Assert(confirmChoice!.GetGlobalRect().End.Y<=root.Size.Y+1,"Small-window actions fit");
            var matrix=new List<object>();
            foreach(var resolution in new[]{new Vector2I(960,640),new Vector2I(1024,768),new Vector2I(1280,720),new Vector2I(1920,1080),new Vector2I(2560,1080),new Vector2I(2560,1440),new Vector2I(3440,1440)})
            {
                DisplayServer.WindowSetSize(resolution);await Settle();
                string tag=$"{resolution.X}x{resolution.Y}";
                CloseOverlay();game.Status=RunStatus.Paused;await Shot("arena-"+tag);
                var viewport=GetViewport().GetVisibleRect().Size;var window=GetWindow().Size;
                Assert(Math.Abs(viewport.X/viewport.Y-window.X/(float)window.Y)<.002f,tag+" viewport matches window aspect, no letterbox");
                Assert(Math.Abs(root.Size.X-viewport.X)<2&&Math.Abs(root.Size.Y-viewport.Y)<2,tag+" HUD covers viewport");
                Assert(renderer.Field.Position.X==0&&Math.Abs(renderer.Field.End.X-viewport.X)<2,tag+" arena fills full width");
                var run=game;MakeReady();ShowIntro();await Shot("title-"+tag);Assert(overlay.GetGlobalRect().Encloses(centeredBody!.GetGlobalRect()),tag+" title fits");
                Press("Play");await Shot("heroes-"+tag);Assert(overlay.GetGlobalRect().Encloses(centeredBody!.GetGlobalRect()),tag+" hero selection fits");
                Press("ChooseStage");await Settle();Assert(overlay.GetGlobalRect().Encloses(centeredBody!.GetGlobalRect()),tag+" stage selection fits");
                CloseOverlay();game=run;renderer.Game=run;game.Status=RunStatus.Running;ShowPause();await Settle();Assert(centeredBody!.Size.X<=540&&overlay.GetGlobalRect().Encloses(centeredBody.GetGlobalRect()),tag+" pause stays compact");
                game.Status=RunStatus.Upgrading;game.OfferSelection=-1;ShowChoices(false);await Settle();
                Assert(confirmChoice!.Disabled,tag+" choice requires selection");
                choiceButtons[1].EmitSignal(Godot.Button.SignalName.Pressed);await Shot("upgrades-"+tag);
                Assert(game.OfferSelection==1&&!confirmChoice.Disabled,tag+" card content click selects");
                var frame=overlay.GetGlobalRect();var panel=choiceBody!.GetGlobalRect();
                Assert(frame.Encloses(panel),tag+" entire choice panel fits");
                Assert(choiceButtons.All(b=>b.GetGlobalRect().Position.Y>=choiceScroll!.GetGlobalRect().Position.Y-1),tag+" card tops visible");
                float gap=confirmChoice.GetGlobalRect().Position.Y-choiceScroll!.GetGlobalRect().End.Y;
                Assert(gap>=0&&gap<130,tag+" actions immediately below cards");
                foreach(var b in choiceButtons)
                {
                    var labels=b.FindChildren("*","Label",true,false).Cast<Label>().ToArray();
                    Assert(labels.Length>=5&&labels.Min(l=>l.GlobalPosition.Y)-b.GlobalPosition.Y<30,tag+" top-aligned card content");
                    Assert(labels.All(l=>b.GetGlobalRect().Grow(1).Encloses(l.GetGlobalRect())),tag+" card labels stay inside card");
                }
                matrix.Add(new{requested=tag,actual=$"{window.X}x{window.Y}",viewport=$"{viewport.X:0}x{viewport.Y:0}",actionsGap=gap});
            }
            game.Status=RunStatus.Reward;game.Rewards=[new(){Kind="upgrade",Id="gauntlets",Rank=1},new(){Kind="gold",Value=50},new(){Kind="xp",Value=75}];ShowChoices(true);await Shot("reward-choices");
            SelectChoice(1);confirmChoice!.EmitSignal(Godot.Button.SignalName.Pressed);Assert(game.Rewards.Count==0&&game.Status==RunStatus.Running,"One chest reward confirmed");
            DisplayServer.WindowSetMode(DisplayServer.WindowMode.ExclusiveFullscreen);await Settle();
            game.Status=RunStatus.Paused;await Shot("fullscreen-arena");
            var full=GetViewport().GetVisibleRect().Size;var screen=DisplayServer.ScreenGetSize(DisplayServer.WindowGetCurrentScreen());
            Assert(Math.Abs(full.X/full.Y-screen.X/(float)screen.Y)<.002f,"Fullscreen fills physical screen aspect");
            game.Status=RunStatus.Upgrading;ShowChoices(false);await Shot("fullscreen-upgrades");
            Assert(overlay.GetGlobalRect().Encloses(choiceBody!.GetGlobalRect()),"Fullscreen choice panel fits");
            DisplayServer.WindowSetMode(DisplayServer.WindowMode.Windowed);
            File.WriteAllText(Path.Combine(directory,"resolutions.json"),System.Text.Json.JsonSerializer.Serialize(matrix,new System.Text.Json.JsonSerializerOptions{WriteIndented=true}));
            GD.Print("PASS: native UI smoke test, title/hero/stage navigation, hero locks, saved-run resume, isolated test modes, compact pause, 7 window sizes + fullscreen, upgrades and boss damage. Screenshots at "+directory);GetTree().Quit();
        }
        catch(Exception e){GD.PushError("UI SMOKE FAILED: "+e);GetTree().Quit(1);}
    }
}
