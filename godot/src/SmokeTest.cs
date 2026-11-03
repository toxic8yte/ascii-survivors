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
            Assert(DisplayServer.WindowGetMode() is DisplayServer.WindowMode.Fullscreen or DisplayServer.WindowMode.ExclusiveFullscreen,"Game starts fullscreen");
            await Shot("00-startup-fullscreen");DisplayServer.WindowSetMode(DisplayServer.WindowMode.Windowed);DisplayServer.WindowSetSize(new(1440,900));await Settle();
            await Shot("01-title");Assert(overlayKind=="intro"&&!overlay.FindChildren("HeroGrid","",true,false).Any(),"Title separate from hero selection");
            Assert(audio.Track=="menu","Title music starts");
            var playingMusic=audio.GetChildren().OfType<AudioStreamPlayer>().Single(p=>p.Playing&&p.Stream is AudioStreamWav w&&w.LoopMode==AudioStreamWav.LoopModeEnum.Forward);
            playingMusic.Seek((float)playingMusic.Stream.GetLength()-.1f);for(int i=0;i<30;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);
            Assert(playingMusic.Playing&&playingMusic.GetPlaybackPosition()<2,"Exported music loops after end");
            Press("Settings");await Shot("01-settings");Assert(overlayKind=="settings"&&overlay.GetGlobalRect().Encloses(centeredBody!.GetGlobalRect()),"Audio menu fits");
            await CheckVideoSettingsUi(directory);
            overlay.FindChildren("SettingsTabs","TabContainer",true,false).Cast<TabContainer>().Single().CurrentTab=1;await Shot("01-audio");
            var musicVolume=overlay.FindChildren("Volume-music","HSlider",true,false).Cast<HSlider>().Single();musicVolume.Value=23;await Settle();Assert(Math.Abs(audio.Music-.23f)<.001f,"Volume slider applies immediately");
            var audioConfig=new ConfigFile();Assert(audioConfig.Load(Path.Combine(directory,"audio.cfg"))==Error.Ok&&Math.Abs((float)audioConfig.GetValue("audio","music").AsDouble()-.23f)<.001f,"Volume persists without touching profile");
            var restoredAudio=new AudioController();AddChild(restoredAudio);restoredAudio.Initialize(Path.Combine(directory,"audio.cfg"),true);Assert(Math.Abs(restoredAudio.Music-.23f)<.001f,"Saved volume restored on initialization");restoredAudio.Play(SoundCue.Shot);RemoveChild(restoredAudio);Assert(restoredAudio.GetChildren().OfType<AudioStreamPlayer>().All(p=>!p.Playing&&p.Stream is null),"Audio releases playbacks when leaving tree");restoredAudio.Free();
            musicVolume.Value=45;CloseAux();Assert(overlayKind=="intro","Audio back returns to title");
            Press("Recipes");Assert(overlayKind=="shop","Locked collection opens Legacy");CloseAux();Assert(overlayKind=="intro","Legacy returns to title");
            Press("Play");await Shot("01-heroes");Assert(overlayKind=="characters"&&overlay.FindChildren("Hero-*","Button",true,false).Count==30,"All hero portrait tiles");
            string locked=content.Heroes.Keys.First(id=>!store.Profile.Heroes.Contains(id));Press("Hero-"+locked);Assert(FindButton("ChooseStage").Disabled&&FindButton("BuyHero").Visible,"Locked hero cannot start");
            Press("Hero-hunter");Press("ChooseStage");await Shot("01-stages");Assert(overlayKind=="stages","Separate stage selection");
            Press("Stage-graveyard");Assert(edit.Map=="graveyard","Stage tile selects map");CloseAux();Assert(overlayKind=="characters","Stage back returns to heroes");CloseAux();Assert(overlayKind=="intro","Hero back returns to title");
            ShowLab();await Shot("01-laboratory");Press("Sandbox");CloseAux();Assert(overlayKind=="lab","Sandbox back returns to lab");
            Press("StressSetup");await Shot("01-stress-setup");edit.Hero=locked;int bank=store.Profile.Gold;Press("StartStress");Assert(game.Options.Stress&&game.Invincible,"Stress mode reachable with locked hero");
            ShowIntro();Press("Play");Assert(!edit.Stress&&!edit.Sandbox&&store.Profile.Heroes.Contains(edit.Hero)&&store.Profile.Gold==bank,"Play clears test mode without unlocking or spending");
            Press("ChooseStage");Press("Stage-forest");Press("StartRun");Assert(game.Status==RunStatus.Running&&game.MapId=="forest"&&!game.IsTest,"Title to heroes to stage starts normal run");await CheckRenderInterpolation();game.Status=RunStatus.Paused;
            for(int i=0;i<35;i++)game.Spawn(i%4==0?"pumpkin":"skeleton",game.Player.Pos+World.Direction(i*.73f)*(160+i*9));
            game.RebuildGrid();game.Cast(game.SelectedWeapon);RefreshHud(true);await Shot("02-arena");
            await CheckGlyphRenderer(directory,"normal");
            audio.Update(game,false,.5);Assert(audio.Track=="night","Night music selected");
            int played=audio.Played;for(int i=0;i<5000;i++)audio.Play(SoundCue.Hit);Assert(audio.Played-played<=1&&audio.ActiveVoices<=12,"Audio flood is rate-limited with bounded voices");
            game.Status=RunStatus.Running;game.GainXp(10);game.CheckLevel();game.Status=RunStatus.Upgrading;ShowChoices(false);await Settle();
            Assert(!confirmChoice!.Visible||confirmChoice.Disabled,"No accidental default selection");
            SelectChoice(0);Assert(!confirmChoice.Disabled&&game.OfferSelection==0,"Explicit selection");
            _Input(new InputEventKey{Keycode=Key.Space,Pressed=true});Assert(game.Status==RunStatus.Upgrading,"Space does not confirm");
            await Shot("03-upgrades");Assert(confirmChoice.GetGlobalRect().End.Y<=root.Size.Y+1,"Choice actions fit viewport");
            game.Choose(0);CloseOverlay();game.Status=RunStatus.Running;ShowPause();await Shot("04-pause");Assert(centeredBody!.Size.X<=540,"Pause buttons stay compact");
            ShowMetrics();await Shot("04-telemetry");Press("ExportTelemetry");Assert(Directory.GetFiles(telemetry.DirectoryPath,"snapshot-*.json").Length>0,"Telemetry report exported from metrics UI");CloseAux();
            string runId=game.RunId;ShowIntro();Assert(store.SavedRun?.RunId==runId,"Title preserves current battle");Press("Continue");Assert(game.RunId==runId&&game.Status==RunStatus.Running,"Continue resumes same battle");
            MakeReady();ShowShop();await Shot("05-legacy");
            edit.Sandbox=true;MakeReady();OpenSandbox();await Shot("06-sandbox-settings");
            edit.Hero="hunter";edit.Enemy="lichLord";edit.Weapon="lightning";edit.Rank=4;edit.Invulnerable=false;StartNew();game.Status=RunStatus.Paused;game.Manual=true;game.Player.Hp=game.Player.MaxHp=1000;
            var boss=game.Enemies.First(e=>e.Def.Boss);boss.SkillClock=0;game.Status=RunStatus.Running;for(int i=0;i<240&&game.Status==RunStatus.Running;i++)game.Tick(1/60f);game.Status=RunStatus.Paused;game.Cast("lightning");renderer.HighlightedWeapon="lightning";RefreshHud(true);await Shot("07-boss-ring");Assert(game.Combat.Hurt>0,"Sandbox boss deals damage");
            audio.Update(game,true,.5);Assert(audio.Track=="boss_music","Boss theme selected");
            ShowBestiary();await Shot("08-bestiary");ShowRecipes();await Shot("09-necronomicon");ShowMap();await Shot("10-map");
            foreach(string weapon in new[]{"needle","garlic"})
            {
                edit.Weapon=weapon;edit.Enemy="dummy";edit.Evolved=false;edit.Manual=false;edit.Rank=2;StartNew();game.Clocks[weapon]=1000;
                game.Cast(weapon);for(int i=0;i<8;i++)game.Tick(1/60f);game.Status=RunStatus.Paused;renderer.HighlightedWeapon=null;await Shot("weapon-"+weapon+"-auto");
                if(weapon=="garlic")
                {game.Elapsed+=.7;await Shot("weapon-garlic-rotation");game.Manual=true;game.Cast("garlic");RefreshHud(true);await Shot("weapon-garlic-manual");}
            }
            foreach(string weapon in new[]{"whip","lightning","crowbar"})foreach(int rank in new[]{0,3})
            {
                edit.Weapon=weapon;edit.Passive=rank==0?"none":"fork";edit.PassiveRank=Math.Max(1,rank);edit.Enemy="dummy";edit.Manual=edit.Evolved=false;edit.Rank=2;StartNew();game.Clocks[weapon]=1000;
                game.Enemies[0].Pos=game.Enemies[0].Prev=game.Player.Pos+new System.Numerics.Vector2(120,0);game.RebuildGrid();game.Cast(weapon);
                for(int i=0;i<6;i++)game.Tick(1/60f);game.Status=RunStatus.Paused;RefreshHud(true);await Shot("duplicator-"+weapon+"-"+rank);
                Assert(game.Visuals.Count(v=>v.Weapon==weapon)==(weapon=="whip"?2:1)+rank,weapon+" Duplicator visible effects");
            }
            edit.Passive="none";edit.PassiveRank=1;edit.Sandbox=false;edit.Weapon="starter";MakeReady();game.Start();game.Status=RunStatus.Upgrading;game.Offers=["gauntlets","flamethrower","area"];DisplayServer.WindowSetSize(new(960,640));ShowChoices(false);SelectChoice(0);await Shot("11-small-window");Assert(confirmChoice!.GetGlobalRect().End.Y<=root.Size.Y+1,"Small-window actions fit");
            var matrix=new List<object>();
            foreach(var resolution in new[]{new Vector2I(960,640),new Vector2I(1024,768),new Vector2I(1280,720),new Vector2I(1920,1080),new Vector2I(2560,1080),new Vector2I(2560,1440),new Vector2I(3440,1440)})
            {
                DisplayServer.WindowSetSize(resolution);await Settle();
                string tag=$"{resolution.X}x{resolution.Y}";
                CloseOverlay();game.Status=RunStatus.Paused;await Shot("arena-"+tag);
                if(resolution.X==960)await CheckGlyphRenderer(directory,"small");
                var viewport=GetViewport().GetVisibleRect().Size;var window=GetWindow().Size;
                Assert(Math.Abs(viewport.X/viewport.Y-window.X/(float)window.Y)<.002f,tag+" viewport matches window aspect, no letterbox");
                Assert(Math.Abs(root.Size.X-viewport.X)<2&&Math.Abs(root.Size.Y-viewport.Y)<2,tag+" HUD covers viewport");
                Assert(renderer.Field.Position.X==0&&Math.Abs(renderer.Field.End.X-viewport.X)<2,tag+" arena fills full width");
                var run=game;MakeReady();ShowIntro();await Shot("title-"+tag);Assert(overlay.GetGlobalRect().Encloses(centeredBody!.GetGlobalRect()),tag+" title fits");
                var castle=overlay.FindChildren("TitleCastle","",true,false).Cast<PseudoArt>().Single();Assert(overlay.GetGlobalRect().Encloses(castle.GetGlobalRect()),tag+" castle fits without clipping");
                Press("Play");await Shot("heroes-"+tag);Assert(overlay.GetGlobalRect().Encloses(centeredBody!.GetGlobalRect()),tag+" hero selection fits");
                Press("ChooseStage");await Settle();Assert(overlay.GetGlobalRect().Encloses(centeredBody!.GetGlobalRect()),tag+" stage selection fits");
                CloseOverlay();game=run;renderer.Game=run;game.Status=RunStatus.Running;ShowPause();await Settle();Assert(centeredBody!.Size.X<=540&&overlay.GetGlobalRect().Encloses(centeredBody.GetGlobalRect()),tag+" pause stays compact");
                Press("Settings");await Shot("settings-"+tag);Assert(overlay.GetGlobalRect().Encloses(centeredBody!.GetGlobalRect()),tag+" settings fit");CloseAux();Assert(overlayKind=="pause"&&game.Status==RunStatus.Paused,tag+" settings return to paused battle");
                ShowEnding();await Shot("ending-"+tag);
                var ending=centeredBody!.GetGlobalRect();Assert(ending.Size.X<=620&&overlay.GetGlobalRect().Encloses(ending),tag+" death screen fits compact panel");
                Assert(ending.GetCenter().DistanceTo(overlay.GetGlobalRect().GetCenter())<2,tag+" death screen centered on both axes");
                Assert(centeredBody.FindChildren("*","Label",true,false).Cast<Label>().All(l=>l.HorizontalAlignment==HorizontalAlignment.Center&&ending.Grow(1).Encloses(l.GetGlobalRect())),tag+" death text centered and contained");
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
            DisplayServer.WindowSetSize(new(1440,900));await Settle();edit.Sandbox=true;edit.Stress=false;edit.Weapon="pistol";edit.Enemy="dummy";edit.Rank=1;StartNew();game.Status=RunStatus.Paused;
            ShowDeveloper();await Shot("developer-menu");Assert(overlay.FindChildren("*","ScrollContainer",true,false).Cast<ScrollContainer>().Single().Size.Y>250,"Developer item list has visible scroll area");int devGold=store.Profile.Gold;Press("DevGold");Assert(store.Profile.Gold==devGold+1000,"Developer gold changes intended wallet");
            var rotation=overlay.FindChildren("Rotation-pentagram","CheckButton",true,false).Cast<CheckButton>().Single();rotation.ButtonPressed=false;
            Assert(store.Profile.DisabledItems.Contains("pentagram")&&game.DisabledItems.Contains("pentagram"),"Developer rotation excludes item");
            var reread=new SaveStore(content,Path.Combine(directory,"state.json"));Assert(reread.Profile.DisabledItems.Contains("pentagram"),"Rotation persists on disk");rotation.ButtonPressed=true;
            Press("Give-pentagram");Assert(game.L("pentagram")==1,"Developer grants pentacle in test");Press("DevAllWeapons");Assert(content.Items.Where(i=>i.Weapon).All(i=>game.L(i.Id)==i.Max),"Developer grants complete test arsenal");
            Press("DevClear");Assert(game.Inventory(true).Count==1&&game.Inventory(false).Count==0,"Developer resets test build");
            Press("ArtGallery");await Shot("roster-gallery");Assert(overlayKind=="gallery"&&overlay.FindChildren("*","ScrollContainer",true,false).Cast<ScrollContainer>().Single().Size.Y>250,"Roster gallery has visible portrait area");CloseAux();
            edit.Sandbox=false;edit.Stress=false;MakeReady();store.Profile.Gold=50000;ShowShop();await Shot("legacy-expanded");Assert(overlay.FindChildren("PowerUp-*","Button",true,false).Count==27,"27 exact Legacy purchases visible");Press("PowerUp-power");Assert(store.Profile.LegacySpent==200&&store.Profile.Gold==49800,"Legacy UI uses exact initial price");
            Press("ResetPowerUps");var reset=GetChildren().OfType<ConfirmationDialog>().Single();Assert(reset.DialogText.Contains("200"),"Reset dialog shows real refund");reset.EmitSignal(ConfirmationDialog.SignalName.Canceled);await Settle();Assert(store.Profile.LegacySpent==200,"Cancel keeps purchase");
            Press("ResetPowerUps");GetChildren().OfType<ConfirmationDialog>().Single().EmitSignal(ConfirmationDialog.SignalName.Confirmed);await Settle();Assert(store.Profile.Gold==50000&&store.Profile.LegacySpent==0&&store.Profile.Ranks.Values.All(r=>r==0),"Confirmed UI reset refunds and clears ranks");store.Profile.Ranks["seal1"]=1;Press("Seals");await Settle();
            overlay.FindChildren("Seal-pentagram","CheckButton",true,false).Cast<CheckButton>().Single().ButtonPressed=true;await Shot("legacy-seals");Assert(store.Profile.SealedItems.Contains("pentagram"),"Player seal UI works");CloseAux();
            MakeReady();game.Start();game.Status=RunStatus.Upgrading;game.DrawOffers();game.Meta["skip"]=1;game.SkipsLeft=2;DisplayServer.WindowSetSize(new(960,640));ShowChoices(false);await Shot("legacy-skip-small");Assert(confirmChoice!.GetGlobalRect().End.Y<=root.Size.Y&&FindButton("SkipUpgrade").GetGlobalRect().End.Y<=root.Size.Y,"Skip and confirm fit small window");
            DisplayServer.WindowSetSize(new(1440,900));MakeReady();CloseOverlay();game.Status=RunStatus.Paused;game.Player.Pos=game.Player.Prev=new(6620,4590);renderer.Camera=game.Player.Pos;RefreshHud(true);await Shot("forest-environment");
            File.WriteAllText(Path.Combine(directory,"resolutions.json"),System.Text.Json.JsonSerializer.Serialize(matrix,new System.Text.Json.JsonSerializerOptions{WriteIndented=true}));
            GD.Print("PASS: native UI smoke test, title/hero/stage navigation, hero locks, saved-run resume, isolated test modes, compact pause, 7 window sizes + fullscreen, upgrades, boss damage, exported music loop, three themes, persisted volume and bounded audio voices. Screenshots at "+directory);GetTree().Quit();
        }
        catch(Exception e){GD.PushError("UI SMOKE FAILED: "+e);GetTree().Quit(1);}
    }
}
