using System.Numerics;

namespace AsciiSurvivors;

public sealed partial class Simulation
{
    public void AddGem(Vector2 pos,float value)
    {
        if(value<=0)return;int key=(int)MathF.Floor(pos.X/64)+(int)MathF.Floor(pos.Y/64)*1024;
        if(gemBins.TryGetValue(key,out var old)&&!old.Taken&&!old.Magnetized){old.Value+=value;return;}
        var gem=new Gem{Pos=pos,Value=value,Bin=key};Gems.Add(gem);gemBins[key]=gem;
    }
    public bool OpenSupply(PickupBox box)
    {
        if(IsTest||Status!=RunStatus.Running||SuppliesTaken.Contains(box.Id)||!MapWorld.Supplies.Contains(box)||Vector2.Distance(box.Pos,Player.Pos)>=32)return false;
        SuppliesTaken.Add(box.Id);
        if(box.Kind=="heal"){Heal(30);Notice="ЯЩИК: ЛЕЧЕНИЕ ДО 30 HP";}
        else if(box.Kind=="level"){Xp+=XpNeed;CheckLevel();Notice="ЯЩИК: БЕСПЛАТНЫЙ УРОВЕНЬ";}
        else{float xp=Gems.Sum(g=>g.Value);Gems.Clear();gemBins.Clear();GainXp(xp);Notice="ЯЩИК: ВСЕ КРИСТАЛЛЫ СОБРАНЫ";}
        Ring("",box.Pos,90,.65f,box.Kind=="heal"?11:box.Kind=="level"?7:16,"+");return true;
    }
    public bool OpenChest(Chest chest)
    {
        if(Status!=RunStatus.Running||!Chests.Remove(chest))return false;ChestsOpened++;Rewards=[];RewardSource=chest.Treasure?"Найден тайник":Content.Enemies[chest.Source].Title;
        var ready=chest.CanEvolve?Content.Recipes.Where(CanEvolve).ToList():[];
        while(Rewards.Count<3&&ready.Count>0){int index=(int)(Random()*ready.Count);Rewards.Add(new(){Kind="evolution",Id=ready[index].Id});ready.RemoveAt(index);}
        bool mega=Content.Enemies[chest.Source].Mega;List<Choice> pool=[new(){Kind="gold",Value=mega?150:50},new(){Kind="xp",Value=mega?200:75}];
        foreach(bool weapon in new[]{true,false}){var candidates=Content.Items.Where(u=>u.Weapon==weapon&&CanUpgrade(u.Id)).Select(u=>u.Id).ToList();var id=Pick(candidates);if(id is not null)pool.Add(new(){Kind="upgrade",Id=id,Rank=L(id)+1});}
        while(Rewards.Count<3&&pool.Count>0){int index=(int)(Random()*pool.Count);Rewards.Add(pool[index]);pool.RemoveAt(index);}if(Rewards.Count<3)Rewards.Add(new(){Kind="shield",Value=3});
        Status=RunStatus.Reward;OfferSelection=-1;return true;
    }
    public bool ClaimReward(int index)
    {
        if(Status!=RunStatus.Reward||index<0||index>=Rewards.Count)return false;var choice=Rewards[index];
        if(choice.Kind=="evolution"){var recipe=Content.Recipes.FirstOrDefault(r=>r.Id==choice.Id);if(recipe is null||!Evolve(recipe))return false;}
        else if(choice.Kind=="upgrade"){if(!ApplyUpgrade(choice.Id))return false;}
        else if(choice.Kind=="gold")AwardGold(choice.Value);
        else if(choice.Kind=="xp")GainXp(choice.Value,false);
        else if(choice.Kind=="shield"){ShieldCharges=(int)choice.Value;ShieldUntil=Time+30;}
        AwardGold(10);Player.Invulnerable=Math.Max(Player.Invulnerable,1);Rewards=[];OfferSelection=-1;Status=RunStatus.Running;CheckLevel();return true;
    }
    private void SeparateCrowd()
    {
        foreach(var e in Enemies.Where(e=>e.Alive))
        {
            int budget=8;
            foreach(var other in Near(e.Pos,55))
            {
                if(other.Id>=e.Id||--budget<0)continue;var delta=e.Pos-other.Pos;float distance=delta.Length(),minimum=(e.Radius+other.Radius)*.7f;if(distance>=minimum)continue;
                var direction=distance>.001f?delta/distance:World.Direction(e.Phase);float amount=Math.Min(3,(minimum-distance)*.25f);MoveEnemy(e,direction*amount);MoveEnemy(other,-direction*amount);
            }
        }
    }
    public void Tick(float dt)
    {
        if(Status!=RunStatus.Running)return;dt=Math.Clamp(dt,0,.05f);float before=Time;Elapsed+=dt;Steps++;LeechBudget=Math.Min(2,LeechBudget+dt*.6f);
        if((int)(Time/60)>(int)(before/60))AwardGold(5);
        Player.Prev=Player.Pos;Player.Invulnerable=Math.Max(0,Player.Invulnerable-dt);Player.DashReady=Math.Max(0,Player.DashReady-dt);Heal((L("regen")*.2f+L("leftSign")*.1f)*dt);
        var direction=MoveInput.LengthSquared()>1?Vector2.Normalize(MoveInput):MoveInput;
        if(Player.Dash>0){Player.Dash=Math.Max(0,Player.Dash-dt);direction=Player.Facing*3.3f;}
        else if(direction.LengthSquared()>.0025f)Player.Facing=Vector2.Normalize(direction);
        MapWorld.Move(ref Player.Pos,Player.Radius,direction*Speed*dt,Arena,true,!Options.Sandbox);
        if(!Options.Sandbox)
        {
            SpawnClock-=dt;if(SpawnClock<=0)SpawnWave();float megaAge=Options.Stress?Time+PressureOffset:Time;
            if(Arena is null&&megaAge>=NextMegaAt&&Enemies.Count<Options.EnemyLimit&&!Enemies.Any(e=>e.Alive&&e.Def.Boss)){var boss=Spawn("darVetro");NextMegaAt=((int)(megaAge/600)+1)*600;LastBoss=boss.Def.Title;Notice="МЕГАБОСС: "+LastBoss;}
            else if(Arena is null&&PressureTime>=NextBossAt&&Enemies.Count<Options.EnemyLimit&&!Enemies.Any(e=>e.Alive&&e.Def.Boss))BeginEncounter();
            UpdateEncounter(dt);
            var roster=Content.Enemies.Values.Where(e=>e.Roster&&e.Boss).OrderBy(e=>e.At).ToArray();var def=roster[RosterBossIndex%roster.Length];float at=def.At+RosterBossIndex/roster.Length*1800;
            if(Arena is null&&megaAge>=at&&!Enemies.Any(e=>e.Alive&&e.Def.Boss)&&Enemies.Count<Options.EnemyLimit){var boss=Spawn(def.Id);RosterBossIndex++;LastBoss=boss.Def.Title;Notice="БОСС: "+LastBoss;}
        }
        else{UpdateEncounter(dt);if(!Enemies.Any(e=>e.Alive)){SandboxClock+=dt;if(SandboxClock>=1){SpawnSandbox();SandboxClock=0;}}else SandboxClock=0;}
        PeakEnemies=Math.Max(PeakEnemies,Enemies.Count);
        foreach(var e in Enemies)if(e.Alive){e.Prev=e.Pos;UpdateEnemy(e,dt);}
        foreach(var summon in summons){if(Enemies.Count>=Options.EnemyLimit-(Arena?.Phase=="warning"?1:0))break;Spawn(summon.Kind,summon.Pos,summon.Member);}summons.Clear();
        foreach(var shot in EnemyShots)
        {
            var start=shot.Pos;shot.Prev=start;shot.Pos+=shot.Velocity*dt;shot.Life-=dt;
            if(Arena?.Phase=="locked"&&(Vector2.Distance(start,Arena.Pos)<Arena.Radius)!=(Vector2.Distance(shot.Pos,Arena.Pos)<Arena.Radius)){shot.Life=0;continue;}
            if(World.SegmentDistance(Player.Pos,start,shot.Pos)<Player.Radius+shot.Radius){HurtPlayer(shot.Damage);shot.Life=0;}
        }
        EnemyShots.RemoveAll(s=>s.Life<=0||s.Pos.X<=0||s.Pos.Y<=0||s.Pos.X>=World.Width||s.Pos.Y>=World.Height);
        RebuildGrid();SeparateCrowd();RebuildGrid();UpdateWeapons(dt);
        foreach(var e in Enemies)if(e.Alive&&Vector2.Distance(e.Pos,Player.Pos)<Player.Radius+e.Radius)HurtPlayer(e.Damage*(e.ChargeTime>0?1.35f:1),e);
        Enemies.RemoveAll(e=>!e.Alive);
        foreach(var gem in Gems)
        {
            var delta=Player.Pos-gem.Pos;float d=delta.Length();if(d<Magnet)gem.Magnetized=true;
            if(gem.Magnetized&&d>1)gem.Pos+=delta/d*Math.Min(d,(290+(1-Math.Min(d/300,1))*280)*dt);
            if(d<18&&Status==RunStatus.Running){gem.Taken=true;if(gemBins.GetValueOrDefault(gem.Bin)==gem)gemBins.Remove(gem.Bin);GainXp(gem.Value);}
        }
        Gems.RemoveAll(g=>g.Taken);CheckLevel();
        foreach(var heart in Hearts)if(Player.Hp<Player.MaxHp&&Vector2.Distance(Player.Pos,heart.Pos)<27&&Status==RunStatus.Running){Heal(heart.Value);Combat.HeartsTaken++;heart.Taken=true;}
        Hearts.RemoveAll(h=>h.Taken||h.Expires>0&&h.Expires<=Time);if(Hearts.Count>128)Hearts.RemoveRange(0,Hearts.Count-128);
        if(!IsTest&&Status==RunStatus.Running)foreach(var box in MapWorld.Supplies)if(!SuppliesTaken.Contains(box.Id)&&Vector2.Distance(box.Pos,Player.Pos)<32){OpenSupply(box);break;}
        if(!Options.Sandbox&&Status==RunStatus.Running)
        {
            foreach(var cache in MapWorld.Treasures)if(!TreasuresTaken.Contains(cache.Id)&&Vector2.Distance(cache.Pos,Player.Pos)<32){TreasuresTaken.Add(cache.Id);var chest=new Chest{Id=NextChestId++,Pos=cache.Pos,Treasure=true};Chests.Add(chest);OpenChest(chest);break;}
            var drop=Chests.FirstOrDefault(c=>Vector2.Distance(c.Pos,Player.Pos)<38);if(drop is not null)OpenChest(drop);
        }
        foreach(var v in Visuals)v.Life-=dt;Visuals.RemoveAll(v=>v.Life<=0);if(Visuals.Count>512)Visuals.RemoveRange(0,Visuals.Count-512);
    }
    public void RepairAfterLoad(Catalog content)
    {
        Content=content;
        if(IsTest||!content.Heroes.ContainsKey(HeroId)||!content.Stages.ContainsKey(MapId)||Level<1||XpNeed<1||XpNeed>5000||RerollGoldSpent<0||RerollGoldSpent>GoldEarned||Options.EnemyLimit is <100 or >24000||Enemies.Count>Options.EnemyLimit||Shots.Count>13000||Gems.Count>50000)throw new InvalidDataException("Invalid run snapshot");
        if(Levels.Count!=content.Items.Count||content.Items.Any(u=>L(u.Id)<0||L(u.Id)>u.Max))throw new InvalidDataException("Invalid inventory");
        if(Offers.Count>3||Offers.Distinct().Count()!=Offers.Count||Offers.Any(id=>!CanUpgrade(id))||Evolutions.Any(id=>!content.Recipes.Any(r=>r.Id==id)))throw new InvalidDataException("Invalid choices");
        if(Inventory(true).Count>5||Inventory(false).Count>5)throw new InvalidDataException("Too many inventory slots");
        if(!float.IsFinite(Player.Pos.X+Player.Pos.Y+Player.Hp+Player.MaxHp)||Player.Hp<=0||Player.Hp>Player.MaxHp||Elapsed<0||!double.IsFinite(Elapsed))throw new InvalidDataException("Invalid player");
        MapWorld=new(MapId,Seed);Player.Pos=Player.Prev=World.Bound(Player.Pos);Player.Dash=0;MoveInput=Vector2.Zero;Firing=false;AimActive=false;QueuedWeapon=null;
        foreach(var e in Enemies){if(!content.Enemies.TryGetValue(e.Kind,out var def)||e.Hp<=0||e.Hp>e.MaxHp||!float.IsFinite(e.Pos.X+e.Pos.Y+e.Hp))throw new InvalidDataException("Invalid enemy");e.Def=def;e.Prev=e.Pos;}
        if(Enemies.Select(e=>e.Id).Distinct().Count()!=Enemies.Count)throw new InvalidDataException("Duplicate enemy IDs");
        foreach(var shot in Shots){if(!content.ById.ContainsKey(shot.Weapon)||!float.IsFinite(shot.Pos.X+shot.Pos.Y+shot.Life+shot.Damage))throw new InvalidDataException("Invalid projectile");shot.Prev=shot.Pos;}
        gemBins.Clear();foreach(var gem in Gems)if(!gem.Magnetized)gemBins[gem.Bin]=gem;
        if(Status==RunStatus.Running)Status=RunStatus.Paused;RebuildGrid();
    }
}
