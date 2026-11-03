using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private Label CenterText(string text,int size,Color color)
    {var label=Paragraph(text,size,color);label.HorizontalAlignment=HorizontalAlignment.Center;return label;}
    private Button MenuAction(string id,string text,Action action,bool primary=false)
    {var button=Button(text,action,primary);button.Name=id;button.CustomMinimumSize=new(0,54);return button;}
    private void PlayFromTitle()
    {
        edit.Sandbox=edit.Stress=false;
        if(!store.Profile.Heroes.Contains(edit.Hero))edit.Hero=store.Profile.Hero;
        MakeReady();ShowCharacters();
    }
    private void ShowIntro()
    {
        if(game.Status is RunStatus.Running or RunStatus.Paused){SaveCurrent();MakeReady();}
        var body=Modal("intro","",width:1100);Gap(body,16);
        var scenery=new MenuBackdrop{Font=renderer.Font};overlay.GetChild(0).AddChild(scenery);Fill(scenery);
        var top=new HBoxContainer();Gap(top,20);body.AddChild(top);
        var quit=MenuAction("Quit","ВЫХОД",()=>GetTree().Quit());quit.SizeFlagsHorizontal=Control.SizeFlags.Fill;quit.CustomMinimumSize=new(160,42);top.AddChild(quit);
        top.AddChild(CenterText("[$] "+store.Profile.Gold+" ЗОЛОТА",20,amber));
        var sound=MenuAction("Settings","[=] НАСТРОЙКИ",ShowSettings);sound.SizeFlagsHorizontal=Control.SizeFlags.Fill;sound.CustomMinimumSize=new(200,42);top.AddChild(sound);
        var screen=MenuAction("Fullscreen","ПОЛНЫЙ ЭКРАН",ToggleFullscreen);screen.SizeFlagsHorizontal=Control.SizeFlags.Fill;screen.CustomMinimumSize=new(180,42);top.AddChild(screen);
        body.AddChild(new Control{CustomMinimumSize=new(0,14)});
        var ascii=CenterText("ASCII",48,amber);ascii.AddThemeColorOverride("font_shadow_color",new Color("050604"));ascii.AddThemeConstantOverride("shadow_offset_y",4);body.AddChild(ascii);
        var logo=CenterText("SURVIVORS",82,new Color("efb86f"));logo.AddThemeColorOverride("font_shadow_color",new Color("672f21"));logo.AddThemeConstantOverride("shadow_offset_x",4);logo.AddThemeConstantOverride("shadow_offset_y",5);body.AddChild(logo);
        body.AddChild(CenterText("—  ПОКА НЕ РАССВЕЛО  —",18,red));
        var castleCenter=new CenterContainer();body.AddChild(castleCenter);
        var castle=Label(MenuBackdrop.Castle,14,new Color("b29a64"));castle.Name="TitleCastle";castle.AccessibilityName="Замок с башнями и закрытыми воротами";castleCenter.AddChild(castle);
        var center=new CenterContainer();body.AddChild(center);var launch=new VBoxContainer{CustomMinimumSize=new(420,0)};Gap(launch,10);center.AddChild(launch);
        launch.AddChild(MenuAction("Play","ИГРАТЬ  →",PlayFromTitle,true));
        if(store.SavedRun is {} saved)launch.AddChild(MenuAction("Continue","ПРОДОЛЖИТЬ · "+saved.Hero.Name+" · "+FormatTime(saved.Time),ContinueRun));
        var sections=new GridContainer{Columns=4};sections.AddThemeConstantOverride("h_separation",12);body.AddChild(sections);
        sections.AddChild(MenuAction("Legacy","[+]  НАСЛЕДИЕ",ShowShop));
        sections.AddChild(MenuAction("Recipes","[?]  НЕКРОНОМИКОН"+(store.Profile.Features.Contains("necronomicon")?"":"\nОТКРЫТЬ · "+content.Features.First(f=>f.Id=="necronomicon").Cost+" ЗОЛ."),()=>OpenFeature("necronomicon")));
        sections.AddChild(MenuAction("Bestiary","(x)  БЕСТИАРИЙ"+(store.Profile.Features.Contains("bestiary")?"":"\nОТКРЫТЬ · "+content.Features.First(f=>f.Id=="bestiary").Cost+" ЗОЛ."),()=>OpenFeature("bestiary")));
        sections.AddChild(MenuAction("Laboratory","[>]  ИСПЫТАНИЯ",ShowLab));
        body.AddChild(CenterText($"ОТКРЫТО ГЕРОЕВ {store.Profile.Heroes.Count} / {content.Heroes.Count}   ·   ЛУЧШИЙ ЗАБЕГ {FormatTime((float)store.Profile.BestTime)}",13,muted));
        body.AddChild(CenterText("ОДИН ГЕРОЙ. ОЧЕНЬ ДОЛГАЯ НОЧЬ.",12,muted));
        if(store.LastError.Length>0)body.AddChild(CenterText(store.LastError,13,red));
    }
    private void ShowCharacters()
    {
        returnView="intro";
        var body=Modal("characters","Выбор героя","Выбери того, кто не доживёт до рассвета. Или приятно удивит.",true,width:1260);
        var wallet=Label("[$] "+store.Profile.Gold+" ЗОЛОТА",15,amber);body.AddChild(wallet);
        var panes=new HBoxContainer();Gap(panes,22);body.AddChild(panes);
        var catalogue=new VBoxContainer{SizeFlagsHorizontal=Control.SizeFlags.ExpandFill};panes.AddChild(catalogue);
        var input=new LineEdit{PlaceholderText="Имя или роль героя",Text=search,ClearButtonEnabled=true};catalogue.AddChild(input);
        var scroll=new ScrollContainer{CustomMinimumSize=new(0,430),SizeFlagsHorizontal=Control.SizeFlags.ExpandFill,SizeFlagsVertical=Control.SizeFlags.ExpandFill,HorizontalScrollMode=ScrollContainer.ScrollMode.Disabled};catalogue.AddChild(scroll);
        var grid=new GridContainer{Columns=5,SizeFlagsHorizontal=Control.SizeFlags.ExpandFill};grid.Name="HeroGrid";grid.AddThemeConstantOverride("h_separation",8);grid.AddThemeConstantOverride("v_separation",8);scroll.AddChild(grid);
        var panel=new PanelContainer{CustomMinimumSize=new(330,0)};panes.AddChild(panel);var detail=new VBoxContainer{CustomMinimumSize=new(290,0)};Gap(detail,12);panel.AddChild(detail);
        var portrait=CenterText("",32,amber);portrait.CustomMinimumSize=new(0,110);detail.AddChild(portrait);
        var name=CenterText("",23,parchment);var role=CenterText("",13,amber);detail.AddChild(name);detail.AddChild(role);
        var description=Paragraph("",14,parchment);detail.AddChild(description);var stats=Paragraph("",14,muted);detail.AddChild(stats);
        detail.AddChild(new Control{SizeFlagsVertical=Control.SizeFlags.ExpandFill});var weapon=Paragraph("",15,amber);detail.AddChild(weapon);
        var actions=new HBoxContainer();Gap(actions,12);body.AddChild(actions);
        var buy=MenuAction("BuyHero","ОТКРЫТЬ ГЕРОЯ",()=>{if(store.Purchase(edit.Hero,"hero")){MakeReady();ShowCharacters();}else Toast(store.LastError.Length>0?store.LastError:"Недостаточно золота");});actions.AddChild(buy);
        var next=MenuAction("ChooseStage","ДАЛЕЕ: ВЫБРАТЬ КАРТУ →",ShowStages,true);actions.AddChild(next);
        void UpdateDetail()
        {
            var hero=content.Heroes[edit.Hero];bool owned=store.Profile.Heroes.Contains(hero.Id);
            portrait.Text=hero.Sprite;name.Text=hero.Name;role.Text=hero.Role;description.Text=hero.Description;
            stats.Text=$"ЖИЗНЬ    {game.Player.MaxHp}\nСКОРОСТЬ {game.Speed:0}\nРЫВОК    {game.DashCooldown:0.0} с";
            weapon.Text="СТАРТОВОЕ ОРУЖИЕ\n"+content.ById[hero.Weapon].Icon+" "+content.ById[hero.Weapon].Title;
            if(hero.ExtraWeapons.Length>0)weapon.Text+="\n"+string.Join("\n",hero.ExtraWeapons.Select(id=>content.ById[id].Icon+" "+content.ById[id].Title));
            buy.Visible=!owned;buy.Text="ОТКРЫТЬ ЗА "+hero.Cost+" ЗОЛ.";buy.Disabled=store.Profile.Gold<hero.Cost;next.Disabled=!owned;
        }
        void BuildHeroes()
        {
            ClearChildren(grid);var group=new ButtonGroup();
            foreach(var hero in content.Heroes.Values.Where(h=>(h.Name+" "+h.Role+" "+h.Id).Contains(search,StringComparison.OrdinalIgnoreCase)))
            {
                bool owned=store.Profile.Heroes.Contains(hero.Id);
                var b=Button("",()=>{edit.Hero=hero.Id;MakeReady();UpdateDetail();});b.Name="Hero-"+hero.Id;b.AccessibilityName=hero.Name;b.TooltipText=hero.Description;b.ToggleMode=true;b.ButtonGroup=group;b.ButtonPressed=hero.Id==edit.Hero;b.CustomMinimumSize=new(0,128);grid.AddChild(b);
                var inset=Margin(8);inset.MouseFilter=Control.MouseFilterEnum.Ignore;b.AddChild(inset);Fill(inset);var tile=new VBoxContainer{MouseFilter=Control.MouseFilterEnum.Ignore,Alignment=BoxContainer.AlignmentMode.Center};Gap(tile,4);inset.AddChild(tile);
                tile.AddChild(CenterText(hero.Sprite,14,owned?amber:muted));tile.AddChild(CenterText(hero.Name,13,owned?parchment:muted));tile.AddChild(CenterText(owned?"ОТКРЫТ":hero.Cost+" ЗОЛ.",11,owned?new Color("91c77c"):muted));
            }
        }
        input.TextChanged+=value=>{search=value;BuildHeroes();};BuildHeroes();UpdateDetail();
    }
    private void ShowStages()
    {
        if(!store.Profile.Heroes.Contains(edit.Hero)){Toast("Сначала открой героя");return;}
        returnView="characters";var body=Modal("stages","Выбор карты",content.Heroes[edit.Hero].Name+" · пять слотов оружия, пять пассивок и сколько угодно неприятностей.",true,width:1040);
        var maps=new HBoxContainer();Gap(maps,18);body.AddChild(maps);var group=new ButtonGroup();
        foreach(var stage in content.Stages.Values)
        {
            bool forest=stage.Id=="forest";
            var b=Button("",()=>{edit.Map=stage.Id;MakeReady();});b.Name="Stage-"+stage.Id;b.AccessibilityName=stage.Title;b.ToggleMode=true;b.ButtonGroup=group;b.ButtonPressed=edit.Map==stage.Id;b.CustomMinimumSize=new(0,380);maps.AddChild(b);
            var inset=Margin(24);inset.MouseFilter=Control.MouseFilterEnum.Ignore;b.AddChild(inset);Fill(inset);var card=new VBoxContainer{MouseFilter=Control.MouseFilterEnum.Ignore};Gap(card,18);inset.AddChild(card);
            card.AddChild(CenterText(forest?"    /\\       /\\    \n   /**\\  /\\ /**\\   \n  /****\\/**\\****\\  \n    || /****\\ ||    \n  . ||   ||   || .  ":"      .---.       \n   +  | R |  +    \n --|--| I |--|--  \n   |  | P |  |    \n  _|__|___|__|_   ",22,forest?new Color("91c77c"):muted));
            card.AddChild(CenterText(stage.Title,24,parchment));card.AddChild(Paragraph(stage.Description,16,parchment));card.AddChild(new Control{SizeFlagsVertical=Control.SizeFlags.ExpandFill});card.AddChild(CenterText("12 800 × 9 600 · БЕСКОНЕЧНАЯ НОЧЬ",12,amber));
        }
        body.AddChild(MenuAction("StartRun","ВОЙТИ В НОЧЬ →",StartNew,true));body.AddChild(CenterText("WASD — ДВИЖЕНИЕ   ·   ПРОБЕЛ — РЫВОК   ·   M — РЕЖИМ ОГНЯ",12,muted));
    }
    private void ShowLab()
    {
        returnView="intro";var body=Modal("lab","Испытания","Место, где можно быть бессмертным. И всё равно что-нибудь сломать.",true,width:700);
        body.AddChild(MenuAction("Sandbox","[>]  ПЕСОЧНИЦА",OpenSandbox));body.AddChild(Paragraph("Любой герой, любое оружие и выбранные враги. Проверяй атаки и эволюции без покупки героев.",15,muted));
        body.AddChild(MenuAction("StressSetup","[!]  НАГРУЗОЧНЫЙ ТЕСТ",ShowStressSetup));body.AddChild(Paragraph("Полный арсенал, неуязвимость и растущая толпа. Результаты испытаний не изменяют обычный прогресс.",15,muted));
    }
    private void ShowStressSetup()
    {
        returnView="lab";var body=Modal("stress","Нагрузочный тест","Все оружия и пассивки на максимуме. Неуязвимость включена. Прогресс не сохраняется.",true,width:760);
        body.AddChild(Field("Герой",Combo(content.Heroes.Values.Select(h=>(h.Id,h.Name)),edit.Hero,id=>edit.Hero=id)));
        body.AddChild(Field("Карта",Combo(content.Stages.Values.Select(s=>(s.Id,s.Title)),edit.Map,id=>edit.Map=id)));
        body.AddChild(Field("Предел врагов",Combo(new[]{1000,3000,6000,12000,24000}.Select(n=>(n.ToString(),n.ToString())),edit.EnemyLimit.ToString(),id=>edit.EnemyLimit=int.Parse(id))));
        body.AddChild(MenuAction("StartStress","ЗАПУСТИТЬ ТЕСТ →",()=>{edit.Sandbox=false;edit.Stress=true;StartNew();},true));
    }
}
