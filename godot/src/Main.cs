using Godot;
using V=System.Numerics.Vector2;

namespace AsciiSurvivors;

public partial class Main : Node
{
    private Catalog content=null!;
    private SaveStore store=null!;
    private Simulation game=null!;
    private AsciiRenderer renderer=null!;
    private Control root=null!,overlay=null!,arenaSpace=null!;
    private VBoxContainer layout=null!;
    private Label hpLabel=null!,timeLabel=null!,enemyLabel=null!,levelLabel=null!,modeLabel=null!,waveLabel=null!,goldLabel=null!,saveLabel=null!,noticeLabel=null!;
    private ProgressBar hpBar=null!,xpBar=null!;
    private HBoxContainer weaponSlots=null!,passiveSlots=null!;
    private Button modeButton=null!;
    private Theme theme=null!;
    private RunOptions edit=new();
    private string overlayKind="",returnView="intro",slotKey="",search="";
    private double uiClock,saveClock,noticeClock;
    private RunStatus lastStatus=RunStatus.Ready;
    private bool finished;
    private bool smokeTesting;
    private readonly Color parchment=new("e8dcc0"),amber=new("e4b66d"),red=new("d75b43"),muted=new("9d9c80"),green=new("142319");
    private static readonly Color[] rarityColors=new[]{"e4d9a6","91c77c","6fb4ff","ff8b2b","f1bf65"}.Select(x=>new Color(x)).ToArray();
    public override void _Ready()
    {
        try
        {
            content=Catalog.Load(file=>Godot.FileAccess.GetFileAsString("res://Data/"+file));
            if(OS.GetCmdlineUserArgs().Contains("--verify"))
            {PortTests.Run(content,Godot.FileAccess.GetFileAsString("res://Tests/reference.json"));GetTree().Quit();return;}
            string? smoke=OS.GetCmdlineUserArgs().FirstOrDefault(a=>a.StartsWith("--smoke-test="));smokeTesting=smoke is not null;
            store=new(content,smokeTesting?Path.Combine(smoke![13..],"state.json"):ProjectSettings.GlobalizePath("user://state.json"));edit.Hero=store.Profile.Hero;edit.Map=store.Profile.Map;edit.Manual=store.Profile.Manual;
            renderer=new();AddChild(renderer);BuildTheme();BuildHud();MakeReady();ShowIntro();
            GetTree().AutoAcceptQuit=false;
            if(smokeTesting)_=SmokeTest(smoke![13..]);
        }
        catch(Exception e){GD.PushError(e.ToString());GetTree().Quit(1);}
    }
    private static StyleBoxFlat Box(Color background,Color border,int padding=12,int width=1)
    {var b=new StyleBoxFlat{BgColor=background,BorderColor=border};b.SetBorderWidthAll(width);b.SetContentMarginAll(padding);return b;}
    private void BuildTheme()
    {
        theme=new(){DefaultFont=renderer.Font,DefaultFontSize=16};
        theme.SetColor("font_color","Label",parchment);theme.SetColor("font_color","Button",parchment);theme.SetColor("font_hover_color","Button",Colors.White);theme.SetColor("font_disabled_color","Button",new Color("666d57"));
        theme.SetStylebox("normal","Button",Box(new Color("192217"),new Color("53583e")));theme.SetStylebox("hover","Button",Box(new Color("303522"),amber));theme.SetStylebox("pressed","Button",Box(new Color("4d3020"),red));theme.SetStylebox("focus","Button",Box(Colors.Transparent,amber,0,2));theme.SetStylebox("disabled","Button",Box(new Color("11180f"),new Color("303827")));
        theme.SetStylebox("panel","PanelContainer",Box(new Color("10190f"),new Color("595b40"),20));theme.SetStylebox("panel","TooltipPanel",Box(new Color("20291a"),amber,14));theme.SetColor("font_color","TooltipLabel",parchment);theme.SetFontSize("font_size","TooltipLabel",15);
        theme.SetStylebox("normal","LineEdit",Box(new Color("1b271c"),new Color("59674a")));theme.SetColor("font_color","LineEdit",parchment);
    }
    private Label Label(string value,int size=16,Color? color=null)
    {var l=new Label{Text=value};l.AddThemeFontSizeOverride("font_size",size);if(color is {} c)l.AddThemeColorOverride("font_color",c);return l;}
    private Button Button(string text,Action action,bool primary=false)
    {var b=new Button{Text=text,MouseDefaultCursorShape=Control.CursorShape.PointingHand,SizeFlagsHorizontal=Control.SizeFlags.ExpandFill,CustomMinimumSize=new(0,42)};if(primary){b.AddThemeStyleboxOverride("normal",Box(red,new Color("f48761"),14));b.AddThemeColorOverride("font_color",new Color("170e09"));}b.Pressed+=action;return b;}
    private static void Fill(Control control)=>control.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
    private static MarginContainer Margin(int size){var c=new MarginContainer();foreach(string side in new[]{"left","right","top","bottom"})c.AddThemeConstantOverride("margin_"+side,size);return c;}
    private static void Gap(BoxContainer container,int size=10)=>container.AddThemeConstantOverride("separation",size);
    private void BuildHud()
    {
        var layer=new CanvasLayer{Layer=5};AddChild(layer);root=new Control{Theme=theme,MouseFilter=Control.MouseFilterEnum.Ignore};layer.AddChild(root);Fill(root);
        root.Resized+=UpdateChoiceLayout;
        layout=new VBoxContainer{MouseFilter=Control.MouseFilterEnum.Ignore};root.AddChild(layout);Fill(layout);Gap(layout,0);
        var header=Margin(16);layout.AddChild(header);var head=new VBoxContainer();header.AddChild(head);Gap(head,8);
        var top=new HBoxContainer();head.AddChild(top);top.AddChild(Label("[+] ASCII SURVIVORS",22,amber));var tag=Label("ПОКА НЕ РАССВЕЛО · C# / GODOT",12,muted);tag.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;top.AddChild(tag);
        top.AddChild(Button("⛶ ВЕСЬ ЭКРАН [G]",ToggleFullscreen));top.AddChild(Button("Ⅱ ПАУЗА [P]",ShowPause));
        var stats=new HBoxContainer();head.AddChild(stats);Gap(stats,24);hpLabel=Label("ЖИЗНЬ");hpLabel.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;stats.AddChild(hpLabel);timeLabel=Label("00:00",22,amber);enemyLabel=Label("ВРАГОВ 0");levelLabel=Label("УРОВЕНЬ 1");stats.AddChild(timeLabel);stats.AddChild(enemyLabel);stats.AddChild(levelLabel);
        hpBar=new ProgressBar{CustomMinimumSize=new(0,7),ShowPercentage=false};hpBar.AddThemeStyleboxOverride("fill",Box(red,red,0,0));hpBar.AddThemeStyleboxOverride("background",Box(new Color("38241d"),Colors.Transparent,0,0));head.AddChild(hpBar);
        xpBar=new ProgressBar{CustomMinimumSize=new(0,5),ShowPercentage=false};xpBar.AddThemeStyleboxOverride("fill",Box(new Color("78bcab"),Colors.Transparent,0,0));head.AddChild(xpBar);
        var actions=new HBoxContainer();head.AddChild(actions);Gap(actions,8);modeButton=Button("АВТОАТАКА [M]",()=>{game.SetManual(!game.Manual);edit.Manual=game.Manual;RefreshHud(true);});actions.AddChild(modeButton);modeLabel=Label("",12,muted);modeLabel.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;actions.AddChild(modeLabel);
        actions.AddChild(Button("ПЕСОЧНИЦА",()=>OpenSandbox()));actions.AddChild(Button("КАРТА",()=>OpenFeature("treasureMap")));actions.AddChild(Button("НЕКРОНОМИКОН",()=>OpenFeature("necronomicon")));actions.AddChild(Button("БЕСТИАРИЙ",()=>OpenFeature("bestiary")));actions.AddChild(Button("ДВИЖОК",ShowMetrics));
        arenaSpace=new Control{MouseFilter=Control.MouseFilterEnum.Ignore,SizeFlagsVertical=Control.SizeFlags.ExpandFill,CustomMinimumSize=new(0,180)};layout.AddChild(arenaSpace);
        var bottom=Margin(16);layout.AddChild(bottom);var bar=new VBoxContainer();bottom.AddChild(bar);Gap(bar,7);var line=new HBoxContainer();bar.AddChild(line);waveLabel=Label("",13,muted);waveLabel.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;line.AddChild(waveLabel);goldLabel=Label("ЗОЛОТО +0",13,amber);line.AddChild(goldLabel);
        weaponSlots=new();passiveSlots=new();bar.AddChild(weaponSlots);bar.AddChild(passiveSlots);Gap(weaponSlots,8);Gap(passiveSlots,8);
        var help=new HBoxContainer();bar.AddChild(help);help.AddChild(Label("* ОПЫТ  [+] ЛЕЧЕНИЕ  [^] УРОВЕНЬ  [U] МАГНИТ",11,muted));saveLabel=Label("",11,muted);saveLabel.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;saveLabel.HorizontalAlignment=HorizontalAlignment.Right;help.AddChild(saveLabel);
        help.AddChild(Label("WASD · ПРОБЕЛ · 1–5 · M · ЛКМ/F · P · G",11,muted));
        noticeLabel=Label("",14,amber);noticeLabel.HorizontalAlignment=HorizontalAlignment.Center;noticeLabel.MouseFilter=Control.MouseFilterEnum.Ignore;root.AddChild(noticeLabel);
    }
    private RunOptions CopyOptions()=>new(){Hero=edit.Hero,Map=edit.Map,Manual=edit.Manual,Weapon=edit.Weapon,Rank=edit.Rank,Passive=edit.Passive,PassiveRank=edit.PassiveRank,Enemy=edit.Enemy,Count=edit.Count,Evolved=edit.Evolved,Invulnerable=edit.Invulnerable,Arena=edit.Arena,Sandbox=edit.Sandbox,Stress=edit.Stress,EnemyLimit=edit.EnemyLimit,Meta=new(store.Profile.Ranks)};
    private void MakeReady(){game=new(content,(uint)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),CopyOptions());renderer.Game=game;renderer.Camera=game.Player.Pos;slotKey="";lastStatus=RunStatus.Ready;finished=false;RefreshHud(true);}
    private void StartNew()
    {
        if(!edit.Sandbox&&!edit.Stress&&!store.Profile.Heroes.Contains(edit.Hero)){Toast("СНАЧАЛА ОТКРОЙ ГЕРОЯ ЗА ЗОЛОТО");return;}
        if(!edit.Sandbox&&!edit.Stress&&store.SavedRun is {} old)store.Finish(old);
        MakeReady();CloseOverlay();game.Start();lastStatus=RunStatus.Ready;saveClock=0;RefreshHud(true);SaveCurrent();Toast(game.Options.Sandbox?game.Invincible?"ПЕСОЧНИЦА · НЕУЯЗВИМОСТЬ":"ПЕСОЧНИЦА · УРОН ВКЛЮЧЁН":game.Options.Stress?"НАГРУЗОЧНЫЙ ТЕСТ · НЕУЯЗВИМОСТЬ":"ДВИГАЙСЯ. НОЧЬ ДОЛГАЯ.");
    }
    private void ContinueRun()
    {
        if(store.SavedRun is not {} saved)return;game=saved;renderer.Game=game;renderer.Camera=game.Player.Pos;edit.Hero=game.HeroId;edit.Map=game.MapId;edit.Sandbox=edit.Stress=false;CloseOverlay();if(game.Status==RunStatus.Paused)game.Status=RunStatus.Running;lastStatus=RunStatus.Ready;finished=false;RefreshHud(true);HandleStatus();
    }
    private void SaveCurrent()
    {if(game.IsTest)return;bool ok=game.Status==RunStatus.Dead?store.Finish(game):store.Checkpoint(game);saveLabel.Text=ok?"ПРОГРЕСС СОХРАНЁН":store.LastError.Length>0?"ОШИБКА СОХРАНЕНИЯ":"АВТОСОХРАНЕНИЕ";if(!ok&&store.LastError.Length>0)Toast(store.LastError);}
    private void Toast(string value){noticeLabel.Text=value;noticeClock=4;}
    private void ToggleFullscreen()=>DisplayServer.WindowSetMode(DisplayServer.WindowGetMode() is DisplayServer.WindowMode.Fullscreen or DisplayServer.WindowMode.ExclusiveFullscreen?DisplayServer.WindowMode.Windowed:DisplayServer.WindowMode.ExclusiveFullscreen);
    public override void _PhysicsProcess(double delta)
    {
        if(game is null)return;
        if(overlayKind.Length==0&&game.Status==RunStatus.Running)
        {
            float x=(Input.IsPhysicalKeyPressed(Key.D)||Input.IsKeyPressed(Key.Right)?1:0)-(Input.IsPhysicalKeyPressed(Key.A)||Input.IsKeyPressed(Key.Left)?1:0),y=(Input.IsPhysicalKeyPressed(Key.S)||Input.IsKeyPressed(Key.Down)?1:0)-(Input.IsPhysicalKeyPressed(Key.W)||Input.IsKeyPressed(Key.Up)?1:0);
            game.MoveInput=new(x,y);game.Firing=Input.IsPhysicalKeyPressed(Key.F)||Input.IsMouseButtonPressed(MouseButton.Left)&&renderer.Field.HasPoint(GetViewport().GetMousePosition());game.Aim=renderer.ToWorld(GetViewport().GetMousePosition());game.AimActive=renderer.Field.HasPoint(GetViewport().GetMousePosition());game.Tick((float)delta);
            saveClock+=delta;if(saveClock>=5){saveClock=0;SaveCurrent();}
        }
        HandleStatus();
    }
    public override void _Process(double delta)
    {
        if(game is null)return;var rect=arenaSpace.GetGlobalRect();renderer.Field=rect;noticeLabel.Position=new(rect.Position.X,rect.Position.Y+72);noticeLabel.Size=new(rect.Size.X,28);
        var target=game.Arena?.Phase=="locked"?game.Arena.Pos:game.Player.Pos;renderer.Camera=V.Lerp(renderer.Camera,target,(float)(1-Math.Exp(-delta*8)));renderer.Interpolation=1;renderer.QueueRedraw();
        if(noticeClock>0){noticeClock-=delta;if(noticeClock<=0)noticeLabel.Text="";}
        if(game.Notice.Length>0){Toast(game.Notice);game.Notice="";}
        uiClock+=delta;if(uiClock>=.1){uiClock=0;RefreshHud();}
    }
    private void HandleStatus()
    {
        if(lastStatus==game.Status)return;lastStatus=game.Status;
        if(game.Status==RunStatus.Upgrading){ShowChoices(false);SaveCurrent();}
        else if(game.Status==RunStatus.Reward){ShowChoices(true);SaveCurrent();}
        else if(game.Status==RunStatus.Dead){if(!finished){SaveCurrent();finished=true;}ShowEnding();}
    }
    private void RefreshHud(bool force=false)
    {
        if(game is null)return;hpLabel.Text=game.Hero.Name.ToUpperInvariant()+" / "+(game.Invincible?"НЕУЯЗВИМОСТЬ":$"{MathF.Ceiling(game.Player.Hp)} / {game.Player.MaxHp}");hpBar.MaxValue=game.Player.MaxHp;hpBar.Value=game.Player.Hp;xpBar.MaxValue=game.XpNeed;xpBar.Value=game.Xp;
        timeLabel.Text=FormatTime(game.Time);enemyLabel.Text=$"ВРАГОВ {game.Enemies.Count} · ИЗГНАНО {game.Kills}";levelLabel.Text="УРОВЕНЬ "+game.Level;
        modeButton.Text=game.Manual?"РУЧНОЙ ОГОНЬ [M]":"АВТОАТАКА [M]";modeLabel.Text=game.Content.ById[game.SelectedWeapon].Title;
        if(game.IsTest)waveLabel.Text=game.Options.Sandbox?"ПЕСОЧНИЦА · БЕЗ ПРОГРЕССИИ":"НАГРУЗОЧНЫЙ ТЕСТ";else waveLabel.Text=game.GetWave().Title+" · ОПЫТ "+game.Xp+" / "+game.XpNeed+" · КРИСТАЛЛЫ "+(game.XpEfficiency*100).ToString("0")+"%";
        goldLabel.Text="ЗОЛОТО ЗАБЕГА +"+game.GoldAvailable;if(game.IsTest)saveLabel.Text="ТЕСТ НЕ МЕНЯЕТ СОХРАНЕНИЕ";
        var weapons=game.Inventory(true);var passives=game.Inventory(false);string key=string.Join(';',weapons.Concat(passives).Select(id=>id+game.L(id)+game.Evolved(id)))+game.SelectedWeapon+game.Manual;
        if(!force&&key==slotKey)return;slotKey=key;foreach(var node in weaponSlots.GetChildren())node.QueueFree();foreach(var node in passiveSlots.GetChildren())node.QueueFree();
        for(int i=0;i<5;i++)
        {
            int slot=i;string? id=i<weapons.Count?weapons[i]:null;var b=Button(id is null?$"{i+1} + СВОБОДНЫЙ СЛОТ":$"{i+1} {InfoIcon(id)} {InfoTitle(id)} {game.L(id)}",()=>{game.SelectSlot(slot);RefreshHud(true);});b.Disabled=id is null;b.ClipText=true;b.CustomMinimumSize=new(0,40);b.AddThemeFontSizeOverride("font_size",13);weaponSlots.AddChild(b);
            if(id is not null){b.TooltipText=ItemTooltip(id);b.AddThemeStyleboxOverride("hover",Box(new Color("72271d"),new Color("ff3c52")));if(game.Manual&&id==game.SelectedWeapon)b.AddThemeStyleboxOverride("normal",Box(new Color("72271d"),new Color("ff3c52")));string weapon=id;b.MouseEntered+=()=>renderer.HighlightedWeapon=weapon;b.MouseExited+=()=>renderer.HighlightedWeapon=null;b.FocusEntered+=()=>renderer.HighlightedWeapon=weapon;b.FocusExited+=()=>renderer.HighlightedWeapon=null;}
            string? passive=i<passives.Count?passives[i]:null;var p=Button(passive is null?"+ ПАССИВКА "+(i+1):content.ById[passive].Icon+" "+content.ById[passive].Title+" "+game.L(passive)+"/"+content.ById[passive].Max,()=>{});p.Disabled=passive is null;p.ClipText=true;p.AddThemeFontSizeOverride("font_size",12);p.CustomMinimumSize=new(0,32);if(passive is not null)p.TooltipText=ItemTooltip(passive);passiveSlots.AddChild(p);
        }
    }
    private string InfoTitle(string id)=>game.Evolved(id)?game.Recipe(id)!.Title:content.ById[id].Title;
    private string InfoIcon(string id)=>game.Evolved(id)?game.Recipe(id)!.Icon:content.ById[id].Icon;
    private string ItemTooltip(string id)=>WrapTooltip(InfoIcon(id)+" "+InfoTitle(id)+"\n"+(content.ById[id].Weapon?"ОРУЖИЕ":"ПАССИВКА")+" · "+game.L(id)+"/"+content.ById[id].Max+"\n"+content.ById[id].Description+(game.Evolved(id)?"\n\n"+game.Recipe(id)!.Description:""));
    private static string WrapTooltip(string value)
    {
        var lines=new List<string>();
        foreach(string paragraph in value.Split('\n'))
        {
            string line="";
            foreach(string word in paragraph.Split(' ')){if(line.Length+word.Length>74){lines.Add(line);line="";}line+=(line.Length>0?" ":"")+word;}
            lines.Add(line);
        }
        return string.Join('\n',lines);
    }
    public override void _Input(InputEvent @event)
    {
        if(game is null)return;
        if(@event is InputEventKey key)
        {
            if(overlayKind is "level" or "reward"&&(key.Keycode==Key.Space||key.Keycode==Key.Escape)){GetViewport().SetInputAsHandled();return;}
            if(!key.Pressed||key.Echo)return;
            if(key.Keycode==Key.F11){ToggleFullscreen();GetViewport().SetInputAsHandled();return;}
            if(overlayKind is "level" or "reward"){if(key.Keycode>=Key.Key1&&key.Keycode<=Key.Key3){SelectChoice((int)(key.Keycode-Key.Key1));GetViewport().SetInputAsHandled();}return;}
            if(key.Keycode==Key.Escape&&overlayKind.Length>0){if(overlayKind=="pause")Resume();else if(overlayKind!="intro")CloseAux();GetViewport().SetInputAsHandled();return;}
            if(overlayKind.Length>0){if(overlayKind=="pause"&&key.Keycode==Key.P)Resume();return;}
            if(key.Keycode==Key.G||key.Keycode==Key.F11){ToggleFullscreen();GetViewport().SetInputAsHandled();return;}
            if(key.Keycode is Key.P or Key.Escape){ShowPause();GetViewport().SetInputAsHandled();return;}
            if(key.Keycode==Key.Space){game.Dash();GetViewport().SetInputAsHandled();return;}
            if(key.Keycode==Key.M){game.SetManual(!game.Manual);edit.Manual=game.Manual;RefreshHud(true);GetViewport().SetInputAsHandled();return;}
            if(key.Keycode>=Key.Key1&&key.Keycode<=Key.Key5){game.SelectSlot((int)(key.Keycode-Key.Key1));RefreshHud(true);GetViewport().SetInputAsHandled();return;}
        }
        if(@event is InputEventMouseButton mouse&&mouse.ButtonIndex==MouseButton.Left&&mouse.Pressed&&overlayKind.Length==0&&renderer.Field.HasPoint(mouse.Position)){game.Aim=renderer.ToWorld(mouse.Position);game.AimActive=true;game.RequestAttack();}
    }
    public override void _Notification(int what)
    {
        if(what==NotificationWMCloseRequest){if(game is not null)SaveCurrent();GetTree().Quit();}
        else if(what==NotificationApplicationFocusOut&&!smokeTesting&&game is not null&&game.Status==RunStatus.Running&&overlayKind.Length==0)ShowPause();
    }
    private static string FormatTime(float seconds)=>$"{(int)seconds/60:00}:{(int)seconds%60:00}";
}
