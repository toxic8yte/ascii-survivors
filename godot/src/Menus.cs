using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private readonly List<Button> choiceButtons=[];
    private readonly List<Color> choiceColors=[];
    private VBoxContainer? choiceBody;
    private ScrollContainer? choiceScroll;
    private VBoxContainer? centeredBody;
    private float centeredWidth;
    private Button? confirmChoice,banishChoice,rerollChoice;
    private Label? choiceSelection,choiceMoney;
    private void CloseOverlay()
    {
        if(overlay is not null&&GodotObject.IsInstanceValid(overlay)){root.RemoveChild(overlay);overlay.QueueFree();}
        overlay=null!;overlayKind="";settingsFps=null;choiceButtons.Clear();choiceColors.Clear();choiceBody=null;choiceScroll=null;centeredBody=null;confirmChoice=banishChoice=rerollChoice=null;choiceSelection=choiceMoney=null;
    }
    private VBoxContainer Modal(string kind,string title,string subtitle="",bool back=false,float width=0)
    {
        CloseOverlay();overlayKind=kind;overlay=new Control{MouseFilter=Control.MouseFilterEnum.Stop};root.AddChild(overlay);Fill(overlay);
        var shade=new ColorRect{Color=new Color(.035f,.055f,.035f),MouseFilter=Control.MouseFilterEnum.Stop};overlay.AddChild(shade);Fill(shade);
        var margin=Margin(28);overlay.AddChild(margin);Fill(margin);var body=new VBoxContainer();Gap(body,12);
        if(kind is "level" or "reward"||width>0)
        {
            var center=new CenterContainer();margin.AddChild(center);center.AddChild(body);centeredBody=body;centeredWidth=width>0?width:1240;
            if(kind is "level" or "reward")choiceBody=body;
            body.CustomMinimumSize=new(Math.Min(centeredWidth,GetViewport().GetVisibleRect().Size.X-56),0);
        }
        else margin.AddChild(body);
        if(title.Length>0){var header=new HBoxContainer();body.AddChild(header);var h=Label(title,30,parchment);h.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;header.AddChild(h);if(back){var close=Button("НАЗАД ×",CloseAux);close.SizeFlagsHorizontal=Control.SizeFlags.Fill;close.CustomMinimumSize=new(160,42);header.AddChild(close);}}
        if(subtitle.Length>0){var sub=Label(subtitle,14,muted);sub.AutowrapMode=TextServer.AutowrapMode.WordSmart;body.AddChild(sub);}
        return body;
    }
    private static void ClearChildren(Node node){foreach(var child in node.GetChildren()){node.RemoveChild(child);child.QueueFree();}}
    private static ScrollContainer Scroll(VBoxContainer body,Control contents)
    {var scroll=new ScrollContainer{SizeFlagsVertical=Control.SizeFlags.ExpandFill,SizeFlagsHorizontal=Control.SizeFlags.ExpandFill,HorizontalScrollMode=ScrollContainer.ScrollMode.Disabled};body.AddChild(scroll);contents.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;scroll.AddChild(contents);return scroll;}
    private Label Paragraph(string value,int size=15,Color? color=null)
    {var label=Label(value,size,color);label.AutowrapMode=TextServer.AutowrapMode.WordSmart;label.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;return label;}
    private OptionButton Combo(IEnumerable<(string Id,string Title)> choices,string selected,Action<string> changed)
    {
        var rows=choices.ToArray();var combo=new OptionButton{SizeFlagsHorizontal=Control.SizeFlags.ExpandFill,CustomMinimumSize=new(0,42)};
        for(int i=0;i<rows.Length;i++){combo.AddItem(rows[i].Title,i);if(rows[i].Id==selected)combo.Select(i);}combo.ItemSelected+=index=>changed(rows[(int)index].Id);return combo;
    }
    private static VBoxContainer Field(string title,Control input)
    {var box=new VBoxContainer{SizeFlagsHorizontal=Control.SizeFlags.ExpandFill};box.AddChild(new Label{Text=title});box.AddChild(input);return box;}
    private void ShowPause()
    {
        if(game.Status==RunStatus.Paused&&overlayKind=="pause"){Resume();return;}if(game.Status!=RunStatus.Running)return;game.Status=RunStatus.Paused;game.MoveInput=default;game.Firing=false;SaveCurrent();
        var body=Modal("pause","Передышка","Враги и таймер на паузе.",width:540);body.Alignment=BoxContainer.AlignmentMode.Center;
        audio.Play(SoundCue.Pause);
        body.AddChild(Button("ПРОДОЛЖИТЬ →",Resume,true));body.AddChild(MenuAction("Settings","НАСТРОЙКИ",ShowSettings));body.AddChild(Button("ПЕСОЧНИЦА / НАСТРОИТЬ ТЕСТ",OpenSandbox));body.AddChild(MenuAction("Developer","МАСТЕРСКАЯ · F8",ShowDeveloper));body.AddChild(Button("ДВИЖОК И УРОН",ShowMetrics));body.AddChild(Button("НАЧАТЬ ЗАНОВО",StartNew));body.AddChild(Button("НА СТАРТОВЫЙ ЭКРАН",()=>{SaveCurrent();MakeReady();ShowIntro();}));
    }
    private void Resume(){CloseOverlay();if(game.Status==RunStatus.Paused)game.Status=RunStatus.Running;lastStatus=game.Status;}
    private void PrepareAux()
    {returnView=overlayKind is "intro" or "characters" or "stages" or "lab" or "stress" or "pause"?overlayKind:overlayKind.Length==0?"game":returnView;if(game.Status==RunStatus.Running){game.Status=RunStatus.Paused;game.Firing=false;game.MoveInput=default;SaveCurrent();}}
    private void CloseAux()
    {string back=returnView;CloseOverlay();if(back=="intro")ShowIntro();else if(back=="shop")ShowShop();else if(back=="characters")ShowCharacters();else if(back=="stages")ShowStages();else if(back=="lab")ShowLab();else if(back=="stress")ShowStressSetup();else if(back=="pause"){game.Status=RunStatus.Running;ShowPause();}else Resume();}
    private void OpenSandbox()
    {
        PrepareAux();var body=Modal("sandbox","Песочница","Любой герой и оружие. Без наград и случайных волн. Урон герою включён, если не отмечена неуязвимость.",true,width:1000);
        var grid=new GridContainer{Columns=2,SizeFlagsVertical=Control.SizeFlags.ExpandFill};grid.AddThemeConstantOverride("h_separation",18);grid.AddThemeConstantOverride("v_separation",12);body.AddChild(grid);
        grid.AddChild(Field("Герой",Combo(content.Heroes.Values.Select(h=>(h.Id,h.Name)),edit.Hero,id=>edit.Hero=id)));
        grid.AddChild(Field("Оружие",Combo(new[]{("starter","Стартовое оружие героя")}.Concat(content.Items.Where(u=>u.Weapon).Select(u=>(u.Id,u.Title))),edit.Weapon,id=>edit.Weapon=id)));
        grid.AddChild(Field("Ранг оружия",Combo(Enumerable.Range(1,4).Select(i=>(i.ToString(),i.ToString())),edit.Rank.ToString(),id=>edit.Rank=int.Parse(id))));
        var evolved=new CheckButton{Text="ЭВОЛЮЦИЯ С ИНГРЕДИЕНТАМИ",ButtonPressed=edit.Evolved};evolved.Toggled+=value=>edit.Evolved=value;grid.AddChild(evolved);
        grid.AddChild(Field("Пассивка",Combo(new[]{("none","Без пассивки")}.Concat(content.Items.Where(u=>!u.Weapon).Select(u=>(u.Id,u.Title))),edit.Passive,id=>edit.Passive=id)));
        grid.AddChild(Field("Ранг пассивки",Combo(Enumerable.Range(1,5).Select(i=>(i.ToString(),i.ToString())),edit.PassiveRank.ToString(),id=>edit.PassiveRank=int.Parse(id))));
        var preview=Paragraph("",14,muted);OptionButton? count=null;CheckButton? ring=null;
        void UpdateEnemy()
        {
            bool boss=content.Enemies.TryGetValue(edit.Enemy,out var e)&&e.Boss;
            if(ring is not null)ring.Disabled=!boss;if(count is not null){count.Disabled=boss&&edit.Arena;if(count.Disabled){edit.Count=1;count.Select(0);}}
            preview.Text=e is null?"Манекен: неподвижная цель с 10 000 HP.":e.Sprite+"\n\n"+e.Description+"\n"+$"{e.Hp} HP · {e.Damage} УРОН";
        }
        grid.AddChild(Field("Противник",Combo(new[]{("dummy","Неподвижный манекен · 10 000 HP")}.Concat(content.Enemies.Values.Select(e=>(e.Id,e.Title+(e.Boss?" · БОСС":"")))),edit.Enemy,id=>{edit.Enemy=id;UpdateEnemy();})));
        count=Combo(new[]{1,5,20}.Select(i=>(i.ToString(),i.ToString())),edit.Count.ToString(),id=>edit.Count=int.Parse(id));grid.AddChild(Field("Количество целей",count));
        var immunity=new CheckButton{Text="НЕУЯЗВИМОСТЬ ГЕРОЯ",ButtonPressed=edit.Invulnerable};immunity.Toggled+=value=>edit.Invulnerable=value;grid.AddChild(immunity);
        ring=new(){Text="БОСС В КОЛЬЦЕ · ОДНА ЦЕЛЬ",ButtonPressed=edit.Arena};ring.Toggled+=value=>{edit.Arena=value;UpdateEnemy();};grid.AddChild(ring);body.AddChild(preview);UpdateEnemy();
        body.AddChild(Button("НАЧАТЬ ТЕСТ →",()=>{edit.Sandbox=true;edit.Stress=false;StartNew();},true));
    }
    private void ShowChoices(bool reward)
    {
        var body=Modal(reward?"reward":"level",reward?game.RewardSource:"Новый уровень "+game.Level,"Время остановлено. Выдели карточку и нажми «Выбрать». Пробел не подтверждает выбор.");
        var cards=new HBoxContainer();Gap(cards,16);choiceScroll=Scroll(body,cards);choiceScroll.SizeFlagsVertical=Control.SizeFlags.Fill;
        cards.SizeFlagsVertical=Control.SizeFlags.ExpandFill;
        int count=reward?game.Rewards.Count:game.Offers.Count;
        for(int i=0;i<count;i++)
        {
            int choice=i;string icon,category,title,description,hint="",rank;Color color=parchment;
            if(!reward)
            {
                var item=content.ById[game.Offers[i]];bool fresh=game.L(item.Id)==0;int tier=game.OfferTiers.GetValueOrDefault(item.Id);color=item.Weapon?rarityColors[tier]:new Color("8fc9b4");
                var recipe=game.Recipe(item.Id)??content.Recipes.FirstOrDefault(r=>r.Weapons.Contains(item.Id));hint=recipe is null?"":"СВЯЗКА: "+string.Join(" + ",recipe.Passives.Keys.Concat(recipe.Weapons).Select(id=>content.ById[id].Title));
                icon=item.Icon;category=(item.Weapon?"ОРУЖИЕ · "+Catalog.RarityNames[tier]:"ПАССИВКА · "+item.Kind)+(fresh?" · НОВОЕ":"");
                title=item.Title;description=item.Description+(item.Weapon?$"\n\nКАЧЕСТВО: +{Simulation.TierBonus[tier]*100:0}% {Simulation.QualityStat(item.Id)} этого оружия. Накопленный бонус: +{(game.WeaponQuality(item.Id)-1+Simulation.TierBonus[tier])*100:0}%.":"");rank=$"СТУПЕНЬ {game.L(item.Id)+1} / {item.Max}";
            }
            else
            {
                var option=game.Rewards[i];title=RewardTitle(option);rank="ОДНА НАГРАДА ИЗ ТРЁХ";
                if(option.Kind=="evolution")color=rarityColors[4];else if(option.Kind=="upgrade"&&content.ById[option.Id].Weapon)color=rarityColors[option.Tier];
                icon=option.Kind switch{"evolution"=>content.Recipes.First(r=>r.Id==option.Id).Icon,"upgrade"=>content.ById[option.Id].Icon,"gold"=>"[$]","xp"=>"<*>",_=>"[+]"};
                category=option.Kind switch{"evolution"=>"ЭВОЛЮЦИЯ","upgrade"=>content.ById[option.Id].Weapon?"ОРУЖИЕ":"ПАССИВКА","gold"=>"ЗОЛОТО","xp"=>"ОПЫТ",_=>"ЗАЩИТА"};
                description=option.Kind switch{"evolution"=>content.Recipes.First(r=>r.Id==option.Id).Description,"upgrade"=>content.ById[option.Id].Description,_=>"Начисляется после подтверждения выбора."};
                if(option.Kind=="upgrade"&&content.ById[option.Id].Weapon){category+=" · "+Catalog.RarityNames[option.Tier];description+=$"\n\nКАЧЕСТВО: +{Simulation.TierBonus[option.Tier]*100:0}% {Simulation.QualityStat(option.Id)} этого оружия.";}
            }
            var b=Button("",()=>SelectChoice(choice));b.Name="Choice"+(i+1);b.TooltipText=title;b.AccessibilityName=title;b.AccessibilityDescription=category+". "+description+". "+rank;b.CustomMinimumSize=new(0,400);b.SizeFlagsVertical=Control.SizeFlags.ExpandFill;
            b.AddThemeStyleboxOverride("normal",Box(new Color("171e13"),color,0,2));b.AddThemeStyleboxOverride("hover",Box(new Color("28301d"),color,0,2));cards.AddChild(b);choiceButtons.Add(b);choiceColors.Add(color);
            var inset=Margin(22);inset.MouseFilter=Control.MouseFilterEnum.Ignore;b.AddChild(inset);Fill(inset);
            var cardBody=new VBoxContainer{MouseFilter=Control.MouseFilterEnum.Ignore};Gap(cardBody,12);inset.AddChild(cardBody);
            var head=new HBoxContainer{MouseFilter=Control.MouseFilterEnum.Ignore};cardBody.AddChild(head);var symbol=Label(icon,32,color);symbol.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;head.AddChild(symbol);head.AddChild(Label((i+1).ToString(),16,muted));
            cardBody.AddChild(Paragraph(category.ToUpperInvariant(),13,color));cardBody.AddChild(Paragraph(title,21,parchment));cardBody.AddChild(Paragraph(description,16,parchment));
            if(hint.Length>0)cardBody.AddChild(Paragraph(hint,13,muted));
            cardBody.AddChild(new Control{MouseFilter=Control.MouseFilterEnum.Ignore,SizeFlagsVertical=Control.SizeFlags.ExpandFill});cardBody.AddChild(Paragraph(rank,13,color));
            cardBody.MinimumSizeChanged+=()=>b.CustomMinimumSize=new(0,Math.Max(400,cardBody.GetCombinedMinimumSize().Y+44));
        }
        choiceSelection=Label("Сначала выдели карточку",14,muted);body.AddChild(choiceSelection);choiceMoney=Label("",13,amber);body.AddChild(choiceMoney);
        var actions=new HBoxContainer();Gap(actions,12);body.AddChild(actions);
        if(!reward)
        {
            banishChoice=Button("ИЗГНАТЬ",()=>{if(game.Banish(game.OfferSelection)){if(game.Status==RunStatus.Upgrading)ShowChoices(false);else CloseOverlay();SaveCurrent();}});actions.AddChild(banishChoice);
            rerollChoice=Button("РЕРОЛЛ",()=>{if(store.Reroll(game)){ShowChoices(false);RefreshHud(true);}else Toast(store.LastError.Length>0?store.LastError:"Не хватает золота забега или новых вариантов");});actions.AddChild(rerollChoice);
        }
        confirmChoice=Button("ВЫБРАТЬ →",()=>
        {
            bool ok=reward?game.ClaimReward(game.OfferSelection):game.Choose(game.OfferSelection);if(!ok)return;CloseOverlay();RefreshHud(true);SaveCurrent();lastStatus=RunStatus.Ready;HandleStatus();
        },true);actions.AddChild(confirmChoice);
        if(!reward&&game.SkipsLeft>0)body.AddChild(MenuAction("SkipUpgrade","ПРОПУСТИТЬ · "+game.SkipsLeft+" · +10% ПОРОГА ОПЫТА",()=>{if(game.SkipUpgrade()){CloseOverlay();RefreshHud(true);SaveCurrent();lastStatus=RunStatus.Ready;HandleStatus();}}));
        body.AddChild(Paragraph(reward?"ОДНА НАГРАДА ИЗ ТРЁХ · 1 / 2 / 3 — ВЫДЕЛИТЬ":"1 / 2 / 3 — ВЫДЕЛИТЬ · ИЗГНАНИЕ ДО КОНЦА ЗАБЕГА · РЕРОЛЛ 5 / 10 / 15… ЗОЛОТА ЗАБЕГА",12,muted));UpdateOverlayLayout();UpdateChoiceSelection();
    }
    private void UpdateOverlayLayout()
    {
        var size=GetViewport().GetVisibleRect().Size;
        if(centeredBody is not null)centeredBody.CustomMinimumSize=new(Math.Min(centeredWidth,size.X-56),0);
        if(choiceScroll is not null)choiceScroll.CustomMinimumSize=new(0,Math.Clamp(size.Y-300-(overlayKind=="level"&&game.SkipsLeft>0?60:0),180,500));
    }
    private void SelectChoice(int index){int count=overlayKind=="reward"?game.Rewards.Count:game.Offers.Count;if(index<0||index>=count)return;game.OfferSelection=index;choiceButtons[index].GrabFocus();UpdateChoiceSelection();SaveCurrent();}
    private void UpdateChoiceSelection()
    {
        bool selected=game.OfferSelection>=0&&game.OfferSelection<choiceButtons.Count;
        for(int i=0;i<choiceButtons.Count;i++)
        {
            bool active=i==game.OfferSelection;
            choiceButtons[i].AddThemeStyleboxOverride("normal",Box(new Color(active?"293020":"171e13"),active?amber:choiceColors[i],0,active?3:2));
            choiceButtons[i].AddThemeStyleboxOverride("focus",Box(Colors.Transparent,amber,0,2));
        }
        if(confirmChoice is not null)confirmChoice.Disabled=!selected;
        if(choiceSelection is not null)choiceSelection.Text=selected?"ВЫДЕЛЕНО: "+(overlayKind=="reward"?RewardTitle(game.Rewards[game.OfferSelection]):content.ById[game.Offers[game.OfferSelection]].Title):"Сначала выдели карточку";
        if(choiceMoney is not null)choiceMoney.Text="ЗОЛОТО ЗАБЕГА: "+game.GoldAvailable;
        if(banishChoice is not null){banishChoice.Disabled=!selected||game.BanishesLeft<=0;banishChoice.Text="ИЗГНАТЬ · "+game.BanishesLeft;}
        if(rerollChoice is not null){rerollChoice.Text=game.FreeRerollsLeft>0?"РЕРОЛЛ · БЕСПЛАТНО · "+game.FreeRerollsLeft:"РЕРОЛЛ · "+game.RerollCost+" ЗОЛ.";rerollChoice.Disabled=game.IsTest||game.GoldAvailable<game.RerollCost||game.RerollPool().Count<game.Offers.Count;}
    }
    private string RewardTitle(Choice option)=>option.Kind switch{"evolution"=>content.Recipes.First(r=>r.Id==option.Id).Title,"upgrade"=>content.ById[option.Id].Title,"gold"=>$"{MathF.Floor(option.Value*.45f*game.Greed)} золота","xp"=>$"{MathF.Floor(option.Value*game.Growth*game.XpEfficiency)} опыта",_=>"Три защитных заряда"};
    private void ShowEnding()
    {
        var body=Modal("ending","",width:620);
        body.AddChild(CenterText("Ночь победила",30,parchment));
        body.AddChild(CenterText(game.IsTest?"Тест окончен. Обычный прогресс не изменился.":$"Сохранено {game.GoldAvailable} золота · на рероллы потрачено {game.RerollGoldSpent}",14,muted));
        body.AddChild(CenterText(" .-. \n(x x)\n |=| \n_|_|_",40,red));body.AddChild(CenterText($"ВРЕМЯ {FormatTime(game.Time)} · ИЗГНАНО {game.Kills} · УРОВЕНЬ {game.Level}",16,amber));body.AddChild(Button("ЕЩЁ ОДИН ЗАБЕГ →",StartNew,true));body.AddChild(Button("НА СТАРТОВЫЙ ЭКРАН",()=>{MakeReady();ShowIntro();}));
    }
    private void ShowShop()
    {
        if(game.Status!=RunStatus.Ready){Toast("Наследие доступно на стартовом экране");return;}returnView="intro";
        var body=Modal("shop","Наследие · "+store.Profile.Gold+" золота","Постоянные улучшения действуют в новых забегах. Герои и разделы открываются навсегда.",true);var grid=new GridContainer{Columns=2};grid.AddThemeConstantOverride("h_separation",16);grid.AddThemeConstantOverride("v_separation",12);Scroll(body,grid);
        foreach(var item in content.Permanents)
        {
            int rank=store.Profile.Ranks.GetValueOrDefault(item.Id),cost=item.Cost*(rank+1)*(rank+1);var b=Button(item.Icon+" "+item.Title+$" · {rank}/{item.Max}\n\n"+item.Description+"\n\n"+(rank==item.Max?"МАКСИМУМ":cost+" ЗОЛОТА"),()=>{if(store.Purchase(item.Id,"permanent")){MakeReady();ShowShop();}else Toast(store.LastError.Length>0?store.LastError:"Недостаточно золота");});b.Disabled=rank>=item.Max||store.Profile.Gold<cost;b.AutowrapMode=TextServer.AutowrapMode.WordSmart;b.Alignment=HorizontalAlignment.Left;b.CustomMinimumSize=new(0,140);grid.AddChild(b);
        }
        foreach(var feature in content.Features)
        {bool owned=store.Profile.Features.Contains(feature.Id);var b=Button(feature.Icon+" "+feature.Title+"\n\n"+feature.Description+"\n\n"+(owned?"ОТКРЫТО":feature.Cost+" ЗОЛОТА"),()=>{if(store.Purchase(feature.Id,"feature")){MakeReady();ShowShop();}else Toast(store.LastError.Length>0?store.LastError:"Недостаточно золота");});b.Disabled=owned||store.Profile.Gold<feature.Cost;b.AutowrapMode=TextServer.AutowrapMode.WordSmart;b.Alignment=HorizontalAlignment.Left;b.CustomMinimumSize=new(0,140);grid.AddChild(b);}
        var footer=new HBoxContainer();body.AddChild(footer);footer.AddChild(Button("ИМПОРТ ПРОФИЛЯ / КОПИИ…",ImportProfile));footer.AddChild(Button("ЭКСПОРТ РЕЗЕРВНОЙ КОПИИ…",ExportProfile));
        body.AddChild(MenuAction("Seals",$"ПЕЧАТИ · {store.Profile.SealedItems.Count} / {store.SealCapacity} ИСКЛЮЧЕНИЙ",ShowSeals));
    }
    private void ShowSeals()
    {
        returnView="shop";var body=Modal("seals","Печати · "+store.Profile.SealedItems.Count+" / "+store.SealCapacity,"Купи места печатей I / II / III за золото в Наследии. Отметь предмет, чтобы убрать его из карточек и сундуков новых забегов. Стартовое оружие героя остаётся. Снять печать можно бесплатно.",true);
        var grid=new GridContainer{Columns=2};Scroll(body,grid);
        foreach(var item in content.Items)
        {
            bool selected=store.Profile.SealedItems.Contains(item.Id);var b=new CheckButton{Text=item.Icon+" "+item.Title,ButtonPressed=selected,Disabled=!selected&&store.Profile.SealedItems.Count>=store.SealCapacity,TooltipText=item.Description,ClipText=true,SizeFlagsHorizontal=Control.SizeFlags.ExpandFill};b.Name="Seal-"+item.Id;grid.AddChild(b);
            b.Toggled+=value=>{if(store.SetSeal(item.Id,value)){MakeReady();ShowSeals();}else{b.SetPressedNoSignal(!value);Toast(store.LastError.Length>0?store.LastError:"Нет свободных мест печати");}};
        }
    }
    private void ImportProfile()
    {
        var dialog=new FileDialog{Title="Импорт профиля или резервной копии",FileMode=FileDialog.FileModeEnum.OpenFile,Access=FileDialog.AccessEnum.Filesystem,Filters=["*.json ; JSON profile"],UseNativeDialog=true};AddChild(dialog);
        dialog.FileSelected+=path=>{var confirm=new ConfirmationDialog{Title="Заменить профиль?",DialogText="Профиль будет заменён данными из файла. Копия Godot восстанавливает и бой. Из браузера переносятся золото, герои и наследие; бой остаётся в браузере. Указанный JSON не изменяется.",OkButtonText="ИМПОРТИРОВАТЬ"};AddChild(confirm);confirm.Confirmed+=()=>{if(store.ImportBrowserProfile(path)){edit.Hero=store.Profile.Hero;edit.Map=store.Profile.Map;edit.Manual=store.Profile.Manual;MakeReady();ShowIntro();Toast("ПРОФИЛЬ ИМПОРТИРОВАН");}else Toast(store.LastError);confirm.QueueFree();};confirm.PopupCentered(new(650,220));dialog.QueueFree();};dialog.Canceled+=()=>dialog.QueueFree();dialog.PopupCenteredRatio(.7f);
    }
    private void ExportProfile()
    {
        var dialog=new FileDialog{Title="Экспорт резервной копии Godot",FileMode=FileDialog.FileModeEnum.SaveFile,Access=FileDialog.AccessEnum.Filesystem,Filters=["*.json ; JSON backup"],CurrentFile="ascii-survivors-godot-backup.json",UseNativeDialog=true};AddChild(dialog);
        dialog.FileSelected+=path=>{try{File.WriteAllText(path,System.Text.Json.JsonSerializer.Serialize(store.Document,SaveStore.JsonOptions));Toast("РЕЗЕРВНАЯ КОПИЯ СОХРАНЕНА");}catch(Exception e)when(e is IOException or UnauthorizedAccessException){Toast(e.Message);}dialog.QueueFree();};dialog.Canceled+=()=>dialog.QueueFree();dialog.PopupCenteredRatio(.7f);
    }
    private void OpenFeature(string id)
    {
        if(!game.IsTest&&!store.Profile.Features.Contains(id)){if(game.Status==RunStatus.Ready)ShowShop();Toast("Раздел открывается за золото в «Наследии»");return;}PrepareAux();
        if(id=="bestiary")ShowBestiary();else if(id=="necronomicon")ShowRecipes();else ShowMap();
    }
    private void ShowBestiary()
    {
        var body=Modal("bestiary","Бестиарий","Перед рывком виден оранжевый коридор, перед телепортацией — метка. Уходи поперёк направления атаки.",true);var grid=new GridContainer{Columns=3};grid.AddThemeConstantOverride("h_separation",14);grid.AddThemeConstantOverride("v_separation",14);Scroll(body,grid);
        foreach(var e in content.Enemies.Values){var panel=new PanelContainer{SizeFlagsHorizontal=Control.SizeFlags.ExpandFill};grid.AddChild(panel);var card=new VBoxContainer();panel.AddChild(card);card.AddChild(Label(e.Sprite,16,AsciiRenderer.Palette[e.Ink]));card.AddChild(Paragraph(e.Title+(e.Boss?" · БОСС":""),18,amber));card.AddChild(Paragraph(e.Description,14,muted));card.AddChild(Label($"{e.Hp} HP · {e.Damage} УРОН",13));card.AddChild(Label(store.Profile.Seen.Contains(e.Id)||game.Encountered.Contains(e.Id)?"ВСТРЕЧЕН":"ЕЩЁ НЕ ВСТРЕЧЕН",11,muted));}
    }
    private void ShowRecipes()
    {
        var body=Modal("recipes","Некрономикон","Оружие — максимальный ранг, пассивки — указанные ранги. Затем сундук подходящего босса с 10-й минуты. Объединение освобождает поглощённый слот.",true);var grid=new GridContainer{Columns=2};grid.AddThemeConstantOverride("h_separation",16);grid.AddThemeConstantOverride("v_separation",16);Scroll(body,grid);
        foreach(var r in content.Recipes){var panel=new PanelContainer{SizeFlagsHorizontal=Control.SizeFlags.ExpandFill};grid.AddChild(panel);var card=new VBoxContainer();panel.AddChild(card);card.AddChild(Paragraph(r.Icon+" "+r.Title,20,amber));foreach(string id in new[]{r.Weapon}.Concat(r.Weapons))card.AddChild(Paragraph(content.ById[id].Icon+" "+content.ById[id].Title+" · "+game.L(id)+"/"+content.ById[id].Max+" МАКС.",14,muted));foreach(var p in r.Passives)card.AddChild(Paragraph(content.ById[p.Key].Icon+" "+content.ById[p.Key].Title+" · "+game.L(p.Key)+"/"+p.Value,14,muted));card.AddChild(Paragraph(r.Description,15));card.AddChild(Label(game.Evolutions.Contains(r.Id)?"ЭВОЛЮЦИЯ ПОЛУЧЕНА":game.CanEvolve(r)?"ГОТОВО · НУЖЕН СУНДУК":"СОБЕРИ КОМПЛЕКТ",12,amber));}
    }
    private void ShowMap()
    {
        var body=Modal("map","Карта сокровищ","@ — ты · X — тайник · $ — сундук · + — лечение · ^ — бесплатный уровень · U — магнит. Бой на паузе.",true);var map=new MapView{Game=game,Font=renderer.Font,SizeFlagsVertical=Control.SizeFlags.ExpandFill,SizeFlagsHorizontal=Control.SizeFlags.ExpandFill,CustomMinimumSize=new(0,380)};body.AddChild(map);body.AddChild(Label($"ТАЙНИКОВ: {12-game.TreasuresTaken.Count} · ПРИПАСОВ: {48-game.SuppliesTaken.Count} · ПОЗИЦИЯ {(int)game.Player.Pos.X} : {(int)game.Player.Pos.Y}",14,muted));
    }
    private void ShowMetrics()
    {
        PrepareAux();var body=Modal("metrics","Движок и вклад оружия","Симуляция — 60 шагов/с. Отрисовка — частота окна. Данные текущего забега.",true);var rows=new VBoxContainer();Scroll(body,rows);
        foreach(string value in new[]{"FPS ОКНА (ВКЛЮЧАЯ ПАУЗУ): "+Engine.GetFramesPerSecond(),"ВРАГОВ: "+game.Enemies.Count+" · ВИДНО: "+renderer.VisibleEnemies+" · ASCII-ОТТИСКОВ: "+renderer.RenderedEnemies,"СИМВОЛОВ В КАДРЕ: "+renderer.BatchedGlyphs+" · ПАКЕТОВ: "+renderer.GlyphDrawCalls,"ЛИМИТ FPS: "+(Engine.MaxFps==0?"БЕЗ ОГРАНИЧЕНИЯ":Engine.MaxFps.ToString())+" · VSYNC: "+(DisplayServer.WindowGetVsyncMode()==DisplayServer.VSyncMode.Enabled?"ВКЛ":"ВЫКЛ"),"ПИК ВРАГОВ: "+game.PeakEnemies,"ПАМЯТЬ ПРОЦЕССА: "+(Telemetry.WorkingMemory()/1048576)+" МБ","ВРЕМЯ: "+FormatTime(game.Time),"ИЗГНАНО: "+game.Kills+" · БОССОВ: "+game.BossKills,"УРОН: "+game.Combat.Damage.ToString("0")+" · ЛИШНИЙ УРОН: "+game.Combat.Overkill.ToString("0"),"ПОЛУЧЕНО УРОНА: "+game.Combat.Hurt.ToString("0")+" · ЛЕЧЕНИЕ: "+game.Combat.Healing.ToString("0"),"АПТЕЧКИ: ВЫПАЛО "+game.Combat.HeartsDropped+" · ВЗЯТО "+game.Combat.HeartsTaken})rows.AddChild(Label(value,16,muted));
        rows.AddChild(Paragraph(telemetry.LastSummary,14,amber));
        body.AddChild(MenuAction("ExportTelemetry","СОХРАНИТЬ ОТЧЁТ ТЕЛЕМЕТРИИ",()=>{try{string path=telemetry.Export(game);Toast("ОТЧЁТ: "+path);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){Toast("ОШИБКА ОТЧЁТА: "+e.Message);}}));
        body.AddChild(MenuAction("OpenTelemetry","ОТКРЫТЬ ПАПКУ ТЕЛЕМЕТРИИ",()=>{try{Directory.CreateDirectory(telemetry.DirectoryPath);OS.ShellOpen(telemetry.DirectoryPath);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){Toast(e.Message);}}));
        rows.AddChild(Label("ВКЛАД ОРУЖИЯ ЗА ЗАБЕГ",20,amber));
        foreach(var pair in game.Combat.Weapons.OrderByDescending(p=>p.Value))rows.AddChild(Label((content.ById.GetValueOrDefault(pair.Key)?.Title??pair.Key)+$" · {pair.Value/Math.Max(1,game.Time):0.0} DPS · {pair.Value/Math.Max(1,game.Combat.Damage)*100:0}%",14));
        if(game.Options.Stress){body.AddChild(Button("ДОБАВИТЬ 5 МИНУТ НАГРУЗКИ",()=>{game.PressureOffset+=300;CloseAux();}));body.AddChild(Button("ВОЛНЫ ПОСЛЕ 10 МИНУТ",()=>{game.PressureOffset=Math.Max(game.PressureOffset,600-game.Time);CloseAux();}));}
    }
}
