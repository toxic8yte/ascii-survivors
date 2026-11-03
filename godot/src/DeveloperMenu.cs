using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private void ShowDeveloper()
    {
        PrepareAux();var body=Modal("developer","Тесты и золото · F8","Добавь золото в кошелёк или открой песочницу, выбери героя и начни тест. Затем F8 — выдай нужное оружие и пассивки кнопками «Дать +1». Тестовый арсенал не меняет прогресс; золото и открытия меняют профиль.",true);
        var top=new GridContainer{Columns=2};top.AddThemeConstantOverride("h_separation",12);top.AddThemeConstantOverride("v_separation",8);body.AddChild(top);
        void GiveGold(int amount)
        {
            int before=store.Profile.Gold;store.Profile.Gold=(int)Math.Min(100000000,(long)store.Profile.Gold+amount);
            if(!store.Write()){store.Profile.Gold=before;Toast(store.LastError);}else Toast("КОШЕЛЁК: "+store.Profile.Gold);
        }
        top.AddChild(MenuAction("DevGold","+1000 ЗОЛОТА",()=>GiveGold(1000)));
        top.AddChild(MenuAction("DevGoldMillion","+10 000 000 ЗОЛОТА",()=>GiveGold(10000000)));
        top.AddChild(MenuAction("DevUnlockHeroes","ОТКРЫТЬ ВСЕХ ГЕРОЕВ",()=>
        {
            var before=new HashSet<string>(store.Profile.Heroes);store.Profile.Heroes.UnionWith(content.Heroes.Keys);
            if(!store.Write()){store.Profile.Heroes=before;Toast(store.LastError);}else Toast("ВСЕ ГЕРОИ ОТКРЫТЫ");
        }));
        top.AddChild(MenuAction("DevSandbox","СОБРАТЬ БИЛД В ПЕСОЧНИЦЕ →",OpenSandbox));
        body.AddChild(MenuAction("ArtGallery","ГАЛЕРЕЯ ГЕРОЕВ И БОССОВ",ShowArtGallery));
        var test=new HBoxContainer();body.AddChild(test);
        test.AddChild(MenuAction("DevClear","ОЧИСТИТЬ ТЕСТОВЫЙ БИЛД",()=>
        {
            if(!game.IsTest){Toast("Сначала начни песочницу или нагрузочный тест");return;}
            string starter=game.SelectedWeapon;foreach(string id in game.Levels.Keys)game.Levels[id]=0;
            game.Levels[starter]=1;game.WeaponOrder=[starter];game.PassiveOrder=[];game.QualityBonus.Clear();game.Evolutions.Clear();game.Shots.Clear();game.Pools.Clear();game.Blasts.Clear();game.Visuals.Clear();game.ShieldCharges=0;game.BibleUntil=0;game.Player.MaxHp=game.Hero.Hp*(1+game.M("vital")*.1f);game.Player.Hp=game.Player.MaxHp;RefreshHud(true);Toast("ОСТАВЛЕНО ОДНО ОРУЖИЕ 1 РАНГА");
        }));
        test.AddChild(MenuAction("DevAllWeapons","ВЫДАТЬ ВСЁ ОРУЖИЕ (ТЕСТ)",()=>
        {
            if(!game.IsTest){Toast("Сначала начни песочницу или нагрузочный тест");return;}
            game.Evolutions.Clear();
            foreach(var item in content.Items.Where(i=>i.Weapon)){game.Levels[item.Id]=item.Max;if(!game.WeaponOrder.Contains(item.Id))game.WeaponOrder.Add(item.Id);game.Clocks[item.Id]=0;}
            RefreshHud(true);Toast("ВСЁ ОРУЖИЕ МАКСИМАЛЬНОГО РАНГА");
        }));
        var rows=new VBoxContainer();Scroll(body,rows);
        var weights=game.TierWeights();float total=weights.Sum();rows.AddChild(Paragraph("ШАНС КАТЕГОРИИ: 50% оружие / 50% пассивка на каждую карточку. Когда категория исчерпана — доступная.\nКАЧЕСТВО: "+string.Join(" · ",Enumerable.Range(0,5).Select(i=>$"{Catalog.RarityNames[i]} {weights[i]/total*100:0.00}%")),14,amber));
        foreach(var item in content.Items)
        {
            var row=new HBoxContainer();rows.AddChild(row);
            var enabled=new CheckButton{Text=(item.Weapon?"ОРУЖИЕ ":"ПАССИВКА ")+item.Icon+" "+item.Title,ButtonPressed=!store.RotationExclusions().Contains(item.Id),SizeFlagsHorizontal=Control.SizeFlags.ExpandFill,TooltipText=item.Description};
            enabled.Name="Rotation-"+item.Id;row.AddChild(enabled);
            enabled.Toggled+=value=>
            {
                var before=new HashSet<string>(store.Profile.DisabledItems);var seals=new HashSet<string>(store.Profile.SealedItems);
                if(value){store.Profile.DisabledItems.Remove(item.Id);store.Profile.SealedItems.Remove(item.Id);}else store.Profile.DisabledItems.Add(item.Id);
                if(!store.Write()){store.Profile.DisabledItems=before;store.Profile.SealedItems=seals;enabled.SetPressedNoSignal(!value);Toast(store.LastError);return;}
                game.DisabledItems=store.RotationExclusions();SaveCurrent();
            };
            var give=Button("ДАТЬ +1",()=>
            {
                if(!game.IsTest){Toast("Выдача предметов доступна в тестовом забеге");return;}
                bool disabled=game.DisabledItems.Remove(item.Id),banished=game.Banished.Remove(item.Id);
                bool ok=game.ApplyUpgrade(item.Id);if(disabled)game.DisabledItems.Add(item.Id);if(banished)game.Banished.Add(item.Id);
                RefreshHud(true);Toast(ok?item.Title+" · "+game.L(item.Id):"МАКСИМАЛЬНЫЙ РАНГ / ПОГЛОЩЕНО ЭВОЛЮЦИЕЙ");
            });give.Name="Give-"+item.Id;give.SizeFlagsHorizontal=Control.SizeFlags.Fill;row.AddChild(give);
        }
    }
    private void ShowArtGallery()
    {
        var body=Modal("gallery","Герои и боссы","Портреты из того же каталога, что используется на арене. Четыре направления у героев; отдельный силуэт у каждого босса.",true);
        var grid=new GridContainer{Columns=3};Scroll(body,grid);
        foreach(var entry in content.Enemies.Values.Where(e=>e.Boss).Select(e=>(e.Title,e.Sprite,e.Ink)).Concat(content.Heroes.Values.Select(h=>(h.Name,h.Sprite,h.Ink))))
        {
            var panel=new PanelContainer{SizeFlagsHorizontal=Control.SizeFlags.ExpandFill};grid.AddChild(panel);var card=new VBoxContainer();panel.AddChild(card);
            card.AddChild(CenterText(entry.Item1,16,amber));card.AddChild(CenterText(entry.Item2,19,AsciiRenderer.Palette[entry.Ink==14?1:entry.Ink]));
        }
    }
}
