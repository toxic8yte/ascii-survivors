using System.Numerics;

namespace AsciiSurvivors;

public sealed partial class Simulation
{
    public void AddGem(Vector2 pos,float value,bool gold=false)
    {
        if(value<=0)return;int key=(int)MathF.Floor(pos.X/64)+(int)MathF.Floor(pos.Y/64)*1024+(gold?10000000:0);
        if(gemBins.TryGetValue(key,out var old)&&!old.Taken&&!old.Magnetized){old.Value+=value;return;}
        var gem=new Gem{Pos=pos,Value=value,Bin=key,Gold=gold};Gems.Add(gem);gemBins[key]=gem;
    }
    public bool OpenSupply(PickupBox box)
    {
        if(IsTest||Status!=RunStatus.Running||SuppliesTaken.Contains(box.Id)||!MapWorld.Supplies.Contains(box)||Vector2.Distance(box.Pos,Player.Pos)>=32)return false;
        SuppliesTaken.Add(box.Id);SoundSignals|=box.Kind=="heal"?SoundCue.Heal:box.Kind=="level"?SoundCue.Upgrade:SoundCue.Gem;
        if(box.Kind=="heal"){Heal(30);Notice="ЯЩИК: ЛЕЧЕНИЕ ДО 30 HP";}
        else if(box.Kind=="level"){Xp+=XpNeed;CheckLevel();Notice="ЯЩИК: БЕСПЛАТНЫЙ УРОВЕНЬ";}
        else{float xp=Gems.Where(g=>!g.Gold).Sum(g=>g.Value);foreach(var coin in Gems.Where(g=>g.Gold))AwardGold(coin.Value);Gems.Clear();gemBins.Clear();GainXp(xp);Notice="ЯЩИК: ВСЕ КРИСТАЛЛЫ СОБРАНЫ";}
        Ring("",box.Pos,90,.65f,box.Kind=="heal"?11:box.Kind=="level"?7:16,"+");return true;
    }
    public bool OpenChest(Chest chest)
    {
        if(Status!=RunStatus.Running||!Chests.Remove(chest))return false;ChestsOpened++;Rewards=[];RewardSource=chest.Treasure?"Найден тайник":Content.Enemies[chest.Source].Title;
        var ready=chest.CanEvolve?Content.Recipes.Where(CanEvolve).ToList():[];
        while(Rewards.Count<3&&ready.Count>0){int index=(int)(Random()*ready.Count);Rewards.Add(new(){Kind="evolution",Id=ready[index].Id});ready.RemoveAt(index);}
        bool mega=Content.Enemies[chest.Source].Mega;List<Choice> pool=[new(){Kind="gold",Value=mega?150:50},new(){Kind="xp",Value=mega?200:75}];
        foreach(bool weapon in new[]{true,false}){var candidates=Content.Items.Where(u=>u.Weapon==weapon&&CanUpgrade(u.Id)).Select(u=>u.Id).ToList();var id=Pick(candidates);if(id is not null)pool.Add(new(){Kind="upgrade",Id=id,Rank=L(id)+1,Tier=weapon?RollTier():0});}
        while(Rewards.Count<3&&pool.Count>0){int index=(int)(Random()*pool.Count);Rewards.Add(pool[index]);pool.RemoveAt(index);}if(Rewards.Count<3)Rewards.Add(new(){Kind="shield",Value=3});
        SoundSignals|=SoundCue.Chest;Status=RunStatus.Reward;OfferSelection=-1;return true;
    }
    public bool ClaimReward(int index)
    {
        if(Status!=RunStatus.Reward||index<0||index>=Rewards.Count)return false;var choice=Rewards[index];
        if(choice.Kind=="evolution"){var recipe=Content.Recipes.FirstOrDefault(r=>r.Id==choice.Id);if(recipe is null||!Evolve(recipe))return false;}
        else if(choice.Kind=="upgrade"){if(!ApplyUpgrade(choice.Id,choice.Tier))return false;}
        else if(choice.Kind=="gold")AwardGold(choice.Value);
        else if(choice.Kind=="xp")GainXp(choice.Value,false);
        else if(choice.Kind=="shield"){ShieldCharges=(int)choice.Value;ShieldUntil=Time+30;}
        SoundSignals|=SoundCue.Upgrade;AwardGold(10);Player.Invulnerable=Math.Max(Player.Invulnerable,1);Rewards=[];OfferSelection=-1;Status=RunStatus.Running;CheckLevel();return true;
    }
    private void SeparateCrowd()
    {
        if(Timings is {} timing){timing.CrowdCandidates=0;timing.CrowdMoves=0;}
        foreach(var e in Enemies)e.CrowdPosition=e.Pos;
        foreach(var e in Enemies)
        {
            if(!e.Alive)continue;
            int tested=0,resolved=0,minX=(int)MathF.Floor((e.Pos.X-55)/80),maxX=(int)MathF.Floor((e.Pos.X+55)/80),minY=(int)MathF.Floor((e.Pos.Y-55)/80),maxY=(int)MathF.Floor((e.Pos.Y+55)/80);
            for(int y=minY;y<=maxY&&tested<32&&resolved<8;y++)for(int x=minX;x<=maxX&&tested<32&&resolved<8;x++)
            {
                if(!grid.TryGetValue(x+y*1024,out var cell)||cell.Count==0)continue;
                // Rotate bounded samples so a dense cell cannot turn separation into an all-pairs scan.
                int samples=Math.Min(4,cell.Count),start=(int)(((long)e.Id*17+Steps*13)%cell.Count);
                for(int i=0;i<samples&&tested<32&&resolved<8;i++)
                {
                    var other=cell[CrowdSampleIndex(cell.Count,start,i)];tested++;if(Timings is {} t)t.CrowdCandidates++;
                    if(!other.Alive||other.Id>=e.Id)continue;var delta=e.CrowdPosition-other.CrowdPosition;float minimum=(e.Radius+other.Radius)*.7f,squared=delta.LengthSquared();if(squared>=minimum*minimum)continue;
                    float distance=MathF.Sqrt(squared);var direction=distance>.001f?delta/distance:World.Direction(e.Phase);float amount=Math.Min(3,(minimum-distance)*.25f);var push=direction*amount;e.CrowdPosition+=push;other.CrowdPosition-=push;resolved++;
                }
            }
        }
        foreach(var e in Enemies)
        {
            var displacement=e.CrowdPosition-e.Pos;float squared=displacement.LengthSquared();if(!e.Alive||squared<.000001f)continue;
            // Resolve terrain/ring once per body, retaining the pair solver's virtual positions above.
            var push=squared>24*24?displacement*(24/MathF.Sqrt(squared)):displacement;
            MoveEnemy(e,push);if(Timings is {} t)t.CrowdMoves++;
        }
    }
    internal static int CrowdSampleIndex(int count,int start,int sample)
    {
        // The cell takes min(4, count) samples: division is by four, or the offset is the sample itself.
        int index=start+(count>=4?(int)((long)sample*count>>2):sample);
        return index>=count?index-count:index;
    }
    public void Tick(float dt)
    {
        if(Status!=RunStatus.Running)return;long started=Timings is null?0:System.Diagnostics.Stopwatch.GetTimestamp();dt=Math.Clamp(dt,0,.05f);float before=Time;Elapsed+=dt;Steps++;LeechBudget=Math.Min(2,LeechBudget+dt*.6f);
        if((int)(Time/60)>(int)(before/60))AwardGold(5);
        Player.Prev=Player.Pos;Player.Invulnerable=Math.Max(0,Player.Invulnerable-dt);Player.DashReady=Math.Max(0,Player.DashReady-dt);Heal((L("regen")*.2f+L("leftSign")*.1f+M("recovery")*.1f)*dt);
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
            var roster=Content.ScheduledBosses;var def=roster[RosterBossIndex%roster.Length];float at=def.At+RosterBossIndex/roster.Length*1800;
            if(Arena is null&&megaAge>=at&&!Enemies.Any(e=>e.Alive&&e.Def.Boss)&&Enemies.Count<Options.EnemyLimit){var boss=Spawn(def.Id);RosterBossIndex++;LastBoss=boss.Def.Title;Notice="БОСС: "+LastBoss;}
        }
        else{UpdateEncounter(dt);if(!Enemies.Any(e=>e.Alive)){SandboxClock+=dt;if(SandboxClock>=1){SpawnSandbox();SandboxClock=0;}}else SandboxClock=0;}
        PeakEnemies=Math.Max(PeakEnemies,Enemies.Count);
        foreach(var e in Enemies)if(e.Alive){e.Prev=e.Pos;UpdateEnemy(e,dt);}
        foreach(var summon in summons){if(Enemies.Count>=Options.EnemyLimit-(Arena?.Phase=="warning"?1:0))break;Spawn(summon.Kind,summon.Pos,summon.Member);}summons.Clear();
        foreach(var shot in EnemyShots)
        {
            var start=shot.Pos;shot.Prev=start;shot.Pos+=shot.Velocity*dt;shot.Life-=dt;
            if(shot.Life<=0)continue;
            if(Arena?.Phase=="locked"&&(Vector2.Distance(start,Arena.Pos)<Arena.Radius)!=(Vector2.Distance(shot.Pos,Arena.Pos)<Arena.Radius)){shot.Life=0;continue;}
        }
        EnemyShots.RemoveAll(s=>s.Life<=0||s.Pos.X<=0||s.Pos.Y<=0||s.Pos.X>=World.Width||s.Pos.Y>=World.Height);
        long crowdStart=Timings is null?0:System.Diagnostics.Stopwatch.GetTimestamp();
        RebuildGrid();SeparateCrowd();RebuildGrid();
        long weaponsStart=Timings is null?0:System.Diagnostics.Stopwatch.GetTimestamp();UpdateWeapons(dt);
        if(!IsTest)foreach(var fire in MapWorld.Campfires)
        {
            if(CampfiresBroken.Contains(fire.Id)||Time<CampfireHitAt.GetValueOrDefault(fire.Id)||Vector2.DistanceSquared(fire.Pos,Player.Pos)>900*900)continue;
            if(!DeflectPumpkin(new(){Weapon="pumpkin",Pos=fire.Pos,Prev=fire.Pos,Radius=18,Life=1},1,false))continue;
            CampfireHitAt[fire.Id]=Time+.5f;CampfireHits[fire.Id]=CampfireHits.GetValueOrDefault(fire.Id)+1;
            if(CampfireHits[fire.Id]<3)continue;BreakCampfire(fire);
        }
        foreach(var shot in EnemyShots)
        {
            if(shot.Life<=0)continue;
            if(DeflectPumpkin(shot)){shot.Life=0;continue;}
            if(World.SegmentDistance(Player.Pos,shot.Prev,shot.Pos)<Player.Radius+shot.Radius){HurtPlayer(shot.Damage);shot.Life=0;}
        }
        EnemyShots.RemoveAll(s=>s.Life<=0);
        if(Timings is {} timing){timing.EnemiesMs=System.Diagnostics.Stopwatch.GetElapsedTime(started,crowdStart).TotalMilliseconds;timing.CrowdMs=System.Diagnostics.Stopwatch.GetElapsedTime(crowdStart,weaponsStart).TotalMilliseconds;timing.WeaponsMs=System.Diagnostics.Stopwatch.GetElapsedTime(weaponsStart).TotalMilliseconds;}
        foreach(var e in Enemies)if(e.Alive&&Vector2.Distance(e.Pos,Player.Pos)<Player.Radius+e.Radius)HurtPlayer(e.Damage*(e.ChargeTime>0?1.35f:1),e);
        Enemies.RemoveAll(e=>!e.Alive);
        foreach(var gem in Gems)
        {
            var delta=Player.Pos-gem.Pos;float d=delta.Length();if(d<Magnet)gem.Magnetized=true;
            if(gem.Magnetized&&d>1)gem.Pos+=delta/d*Math.Min(d,(290+(1-Math.Min(d/300,1))*280)*dt);
            if(d<18&&Status==RunStatus.Running){SoundSignals|=SoundCue.Gem;gem.Taken=true;if(gemBins.GetValueOrDefault(gem.Bin)==gem)gemBins.Remove(gem.Bin);if(gem.Gold)AwardGold(gem.Value);else GainXp(gem.Value);}
        }
        Gems.RemoveAll(g=>g.Taken);CheckLevel();
        foreach(var heart in Hearts)if(Player.Hp<Player.MaxHp&&Vector2.Distance(Player.Pos,heart.Pos)<27&&Status==RunStatus.Running){SoundSignals|=SoundCue.Heal;Heal(heart.Value);Combat.HeartsTaken++;heart.Taken=true;}
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
        // Older saves predate the dash passive; preserve their run and pending choices.
        Levels.TryAdd("dash",0);
        foreach(var item in content.Permanents)Meta.TryAdd(item.Id,0);
        if(OfferTiers.Any(p=>!Offers.Contains(p.Key)||p.Value is <0 or >4)||QualityBonus.Any(p=>!content.ById.TryGetValue(p.Key,out var item)||!item.Weapon||!float.IsFinite(p.Value)||p.Value<0||p.Value>item.Max*.5f))throw new InvalidDataException("Invalid upgrade quality");
        if(Rewards.Any(r=>r.Tier is <0 or >4))throw new InvalidDataException("Invalid chest quality");
        if(FreeRerollsUsed<0||FreeRerollsUsed>RerollsUsed||FreeRerollsUsed>M("reroll")*2||SkipsLeft<0||SkipsLeft>M("skip")*2)throw new InvalidDataException("Invalid choice charges");
        if(IsTest||!content.Heroes.ContainsKey(HeroId)||!content.Stages.ContainsKey(MapId)||Level<1||XpNeed<1||XpNeed>5000||RerollGoldSpent<0||RerollGoldSpent>GoldEarned||Options.EnemyLimit is <100 or >24000||Enemies.Count>Options.EnemyLimit||Shots.Count>13000||Gems.Count>50000)throw new InvalidDataException("Invalid run snapshot");
        if(Levels.Count!=content.Items.Count||content.Items.Any(u=>L(u.Id)<0||L(u.Id)>u.Max))throw new InvalidDataException("Invalid inventory");
        if(Offers.Count>3||Offers.Distinct().Count()!=Offers.Count||Offers.Any(id=>!CanUpgrade(id))||Evolutions.Any(id=>!content.Recipes.Any(r=>r.Id==id)))throw new InvalidDataException("Invalid choices");
        if(Inventory(true).Count>5||Inventory(false).Count>5)throw new InvalidDataException("Too many inventory slots");
        if(!float.IsFinite(Player.Pos.X+Player.Pos.Y+Player.Hp+Player.MaxHp)||Player.Hp<=0||Player.Hp>Player.MaxHp||Elapsed<0||!double.IsFinite(Elapsed))throw new InvalidDataException("Invalid player");
        MapWorld=new(MapId,Seed);foreach(int id in CampfiresBroken)if(id>=0&&id<MapWorld.Cells.Length&&MapWorld.Cells[id]?.Kind=="campfire")MapWorld.Cells[id]=null;Player.Pos=Player.Prev=World.Bound(Player.Pos);Player.Dash=0;MoveInput=Vector2.Zero;Firing=false;AimActive=false;QueuedWeapon=null;
        foreach(var e in Enemies){if(!content.Enemies.TryGetValue(e.Kind,out var def)||e.Hp<=0||e.Hp>e.MaxHp||!float.IsFinite(e.Pos.X+e.Pos.Y+e.Hp))throw new InvalidDataException("Invalid enemy");e.Def=def;e.Prev=e.Pos;}
        if(Enemies.Select(e=>e.Id).Distinct().Count()!=Enemies.Count)throw new InvalidDataException("Duplicate enemy IDs");
        foreach(var shot in Shots){if(!content.ById.ContainsKey(shot.Weapon)||!float.IsFinite(shot.Pos.X+shot.Pos.Y+shot.Life+shot.Damage))throw new InvalidDataException("Invalid projectile");shot.Prev=shot.Pos;}
        gemBins.Clear();foreach(var gem in Gems)if(!gem.Magnetized)gemBins[gem.Bin]=gem;
        if(Status==RunStatus.Running)Status=RunStatus.Paused;RebuildGrid();
    }
    public bool BreakCampfire(PickupBox fire)
    {
        if(IsTest||!MapWorld.Campfires.Contains(fire)||!CampfiresBroken.Add(fire.Id))return false;
        MapWorld.Cells[fire.Id]=null;float roll=Random();
        if(roll<.55f){Hearts.Add(new(){Pos=fire.Pos+new Vector2(-10,0),Value=20,Expires=Time+180});Combat.HeartsDropped++;}
        if(roll>=.45f)AddGem(fire.Pos+new Vector2(12,0),5+Random()*7,true);
        Ring("",fire.Pos,24,.25f,12,"✦");SoundSignals|=SoundCue.Explosion;return true;
    }
}
