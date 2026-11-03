using System.Numerics;
using System.Text.Json.Serialization;

namespace AsciiSurvivors;

public sealed partial class Simulation
{
    [JsonIgnore] public Catalog Content=null!;
    [JsonIgnore] public World MapWorld=null!;
    [JsonIgnore] public TickTimings? Timings;
    [JsonIgnore] private readonly Dictionary<int,List<Enemy>> grid=[];
    [JsonIgnore] private readonly Stack<List<Enemy>> gridPool=[];
    [JsonIgnore] private readonly Dictionary<int,Gem> gemBins=[];
    [JsonIgnore] public Vector2 MoveInput,Aim;
    [JsonIgnore] public bool Firing,AimActive;
    [JsonIgnore] public string? QueuedWeapon;
    public RunOptions Options=new();
    public PlayerState Player=new();
    public RunStatus Status=RunStatus.Ready;
    public string HeroId="hunter",MapId="forest",RunId="",SelectedWeapon="needle",LastBoss="",Notice="";
    public uint Seed=1,RandomState=1;
    public double Elapsed;
    public long Steps;
    public int Level=1,Xp,XpNeed=6,Kills,BossKills,ChestsOpened,NextId=1,NextChestId=1,PeakEnemies,BossIndex,RosterBossIndex,ClockStep,RevivesUsed,RerollsUsed,RerollGoldSpent,BanishesLeft=3,OfferSelection=-1;
    public int GoldEarned,ShieldCharges;
    public float GoldCarry,XpCarry,PressureOffset,SpawnClock=.35f,NextBossAt=60,NextMegaAt=600,SpawnRadius=650,ArenaRadius=205,BibleUntil,ShieldUntil,LeechBudget=2,SandboxClock;
    public bool Manual;
    public Dictionary<string,int> Levels=[],Meta=[];
    public Dictionary<string,float> Clocks=[];
    public Dictionary<int,float> BibleHits=[],WaterHits=[];
    public HashSet<string> Evolutions=[],Banished=[],Encountered=[];
    public HashSet<int> TreasuresTaken=[],SuppliesTaken=[];
    public List<string> WeaponOrder=[],PassiveOrder=[],Offers=[];
    public List<Enemy> Enemies=[];
    public List<Projectile> Shots=[],EnemyShots=[];
    public List<Pool> Pools=[];
    public List<Blast> Blasts=[];
    public List<Visual> Visuals=[];
    public List<Gem> Gems=[];
    public List<Heart> Hearts=[];
    public List<Chest> Chests=[];
    public List<Choice> Rewards=[];
    public string RewardSource="";
    public Encounter? Arena;
    public CombatStats Combat=new();
    public Simulation(){}
    public Simulation(Catalog content,uint seed,RunOptions options)
    {
        Content=content;Options=options;Seed=seed==0?1:seed;RandomState=Seed;HeroId=options.Hero;MapId=options.Map;Manual=options.Manual;
        if(!content.Heroes.ContainsKey(HeroId)||!content.Stages.ContainsKey(MapId))throw new ArgumentException("Unknown hero or stage");
        RunId=$"{Seed}-{Guid.NewGuid():N}";MapWorld=new World(MapId,Seed);
        Levels=content.Items.ToDictionary(x=>x.Id,_=>0);Meta=content.Permanents.ToDictionary(x=>x.Id,x=>options.Sandbox?0:Math.Clamp(options.Meta.GetValueOrDefault(x.Id),0,x.Max));
        Player.Hp=Player.MaxHp=Hero.Hp+M("vital")*10;
        SelectedWeapon=Hero.Weapon;Levels[SelectedWeapon]=1;WeaponOrder.Add(SelectedWeapon);
        foreach(string id in Hero.ExtraWeapons){Levels[id]=1;WeaponOrder.Add(id);}
        foreach(var item in content.Items.Where(x=>x.Weapon))Clocks[item.Id]=item.Id=="needle"?.15f:.3f;
        Clocks["blades"]=0;Clocks["poison"]=0;Clocks["pulse"]=1.2f;
        if(options.Stress)foreach(var item in content.Items)Levels[item.Id]=item.Max;
        if(options.Sandbox)
        {
            if(content.ById.TryGetValue(options.Weapon,out var weapon)&&weapon.Weapon){foreach(string id in Levels.Keys)Levels[id]=0;WeaponOrder=[weapon.Id];SelectedWeapon=weapon.Id;}
            foreach(string id in WeaponOrder)Levels[id]=Math.Clamp(options.Rank,1,content.ById[id].Max);
            if(content.ById.TryGetValue(options.Passive,out var passive)&&!passive.Weapon)for(int i=0;i<Math.Clamp(options.PassiveRank,1,passive.Max);i++)ApplyUpgrade(passive.Id);
            var recipe=content.Recipes.FirstOrDefault(r=>r.Weapon==SelectedWeapon||r.Weapons.Contains(SelectedWeapon));
            if(options.Evolved&&recipe is not null){foreach(string id in new[]{recipe.Weapon}.Concat(recipe.Weapons))Levels[id]=content.ById[id].Max;foreach(var p in recipe.Passives)while(L(p.Key)<p.Value)ApplyUpgrade(p.Key);Evolve(recipe);}
        }
    }
    [JsonIgnore] public HeroDef Hero=>Content.Heroes[HeroId];
    [JsonIgnore] public float Time=>(float)Elapsed;
    [JsonIgnore] public bool IsTest=>Options.Sandbox||Options.Stress;
    [JsonIgnore] public bool Invincible=>Options.Stress||Options.Sandbox&&Options.Invulnerable;
    public int L(string id)=>Levels.GetValueOrDefault(id);
    public int M(string id)=>Meta.GetValueOrDefault(id);
    [JsonIgnore] public float Power=>(1+L("power")*.1f)*(1+M("power")*.05f+Hero.Trait("power"));
    [JsonIgnore] public float Haste=>(1+L("haste")*.08f)*(1+M("haste")*.04f);
    [JsonIgnore] public float Area=>1+L("area")*.06f+L("silverRing")*.05f+Hero.Trait("area");
    [JsonIgnore] public float Duration=>1+L("duration")*.08f+L("silverRing")*.03f;
    [JsonIgnore] public float ProjectileSpeed=>1+L("velocity")*.08f;
    [JsonIgnore] public float Armor=>L("armor")+M("armor")+Hero.Trait("armor");
    [JsonIgnore] public float Growth=>1+L("growth")*.05f+M("growth")*.03f;
    [JsonIgnore] public float XpEfficiency=>1/(1+(Level-1)*.08f);
    [JsonIgnore] public float Luck=>1+L("luck")*.1f;
    [JsonIgnore] public float Greed=>1+L("greed")*.15f+L("capital")*.15f+L("curse")*.2f+(L("goldRing")+L("rightSign"))*.1f+Hero.Trait("greed");
    [JsonIgnore] public float Speed=>Hero.Speed*(1+.08f*L("stride")+.03f*M("stride"))*(Player.SlowUntil>Time?.65f:1);
    [JsonIgnore] public float DashCooldown=>Hero.Dash*.6f*MathF.Pow(.95f,L("stride"));
    [JsonIgnore] public float Magnet=>Hero.Magnet+L("magnet")*20+M("magnet")*15;
    [JsonIgnore] public float PressureTime=>(Time+PressureOffset)*(1+L("curse")*.1f+(L("goldRing")+L("rightSign"))*.08f);
    [JsonIgnore] public float WaveAge=>PressureTime<=600?PressureTime*.65f:390+(PressureTime-600)*.85f;
    [JsonIgnore] public int RerollCost=>5*(RerollsUsed+1);
    [JsonIgnore] public int GoldAvailable=>Math.Max(0,GoldEarned-RerollGoldSpent);
    public float Random()
    {
        unchecked{uint t=RandomState+=0x6D2B79F5;t=(t^(t>>15))*(t|1);t^=t+(t^(t>>7))*(t|61);return Math.Min(.99999994f,(t^(t>>14))/4294967296f);}
    }
    public void Start()
    {
        if(Status!=RunStatus.Ready)return;Status=RunStatus.Running;SoundSignals|=SoundCue.Start;
        if(Options.Sandbox){SpawnSandbox();return;}
        for(int i=0;i<8;i++){float a=i/8f*MathF.Tau+Random()*.2f;Spawn(MapId=="forest"?"grave_bat":"ghoul",Player.Pos+World.Direction(a)*(310+Random()*100));}
    }
    public List<string> Inventory(bool weapon)
    {
        var all=Content.Items.Where(x=>x.Weapon==weapon).Select(x=>x.Id);
        return (weapon?WeaponOrder:PassiveOrder).Concat(all).Distinct().Where(id=>L(id)>0&&!Consumed(id)).ToList();
    }
    public bool Consumed(string id)=>Content.Recipes.Any(r=>Evolutions.Contains(r.Id)&&r.Weapons.Contains(id));
    public RecipeDef? Recipe(string weapon)=>Content.Recipes.FirstOrDefault(r=>r.Weapon==weapon);
    public bool Evolved(string weapon)=>Recipe(weapon) is {} r&&Evolutions.Contains(r.Id);
    public bool CanEvolve(RecipeDef r)=>!Evolutions.Contains(r.Id)&&new[]{r.Weapon}.Concat(r.Weapons).All(id=>!Consumed(id)&&L(id)==Content.ById[id].Max)&&r.Passives.All(p=>L(p.Key)>=p.Value);
    public bool Evolve(RecipeDef r)
    {
        if(!CanEvolve(r))return false;Evolutions.Add(r.Id);
        foreach(string id in r.Weapons){Levels[id]=0;if(SelectedWeapon==id)SelectedWeapon=r.Weapon;}
        Clocks[r.Weapon]=0;if(r.Id=="mikolenin"){Shots.RemoveAll(s=>s.Weapon=="boomerang");Blasts.RemoveAll(b=>b.Weapon=="hammer");}
        SoundSignals|=SoundCue.Evolution;Notice="ЭВОЛЮЦИЯ: "+r.Title;return true;
    }
    public bool CanUpgrade(string id)=>Content.ById.TryGetValue(id,out var u)&&!Banished.Contains(id)&&!Consumed(id)&&L(id)<u.Max&&(L(id)>0||IsTest||Inventory(u.Weapon).Count<5);
    public bool ApplyUpgrade(string id)
    {
        if(!CanUpgrade(id))return false;var u=Content.ById[id];if(L(id)==0)(u.Weapon?WeaponOrder:PassiveOrder).Add(id);Levels[id]++;
        if(id=="vital"){Player.MaxHp+=25;Heal(20);}if(id=="leftSign"){Player.MaxHp+=10;Heal(10);}if(u.Weapon)Clocks[id]=Math.Min(Clocks.GetValueOrDefault(id),.2f);return true;
    }
    private float Weight(string id)
    {var u=Content.ById[id];int tier=Math.Max(0,Array.IndexOf(Catalog.RarityIds,u.Rarity));return u.OfferWeight??Catalog.RarityWeights[tier]*(1+(Luck-1)*tier);}
    private string? Pick(List<string> pool)
    {if(pool.Count==0)return null;float r=Random()*pool.Sum(Weight);foreach(string id in pool){r-=Weight(id);if(r<0)return id;}return pool[^1];}
    public void DrawOffers(IEnumerable<string>? candidates=null)
    {
        var pool=(candidates??Content.Items.Select(x=>x.Id).Where(CanUpgrade)).ToList();Offers=[];
        void Take(List<string> choices){string? id=Pick(choices);if(id is not null){Offers.Add(id);pool.Remove(id);}}
        Take(pool.Where(id=>Content.ById[id].Weapon&&L(id)==0).ToList());
        while(Offers.Count(id=>Content.ById[id].Weapon)<2&&pool.Any(id=>Content.ById[id].Weapon))Take(pool.Where(id=>Content.ById[id].Weapon).ToList());
        Take(pool.Where(id=>!Content.ById[id].Weapon).ToList());while(Offers.Count<3&&pool.Count>0)Take(pool);OfferSelection=-1;
    }
    public List<string> RerollPool()=>Content.Items.Where(u=>CanUpgrade(u.Id)&&!Offers.Contains(u.Id)).Select(u=>u.Id).ToList();
    public bool Reroll()
    {
        var pool=RerollPool();if(IsTest||Status!=RunStatus.Upgrading||Offers.Count==0||pool.Count<Offers.Count||GoldAvailable<RerollCost)return false;
        RerollGoldSpent+=RerollCost;RerollsUsed++;DrawOffers(pool);return true;
    }
    public bool Banish(int index)
    {
        if(Status!=RunStatus.Upgrading||BanishesLeft<=0||index<0||index>=Offers.Count)return false;string id=Offers[index];Banished.Add(id);BanishesLeft--;
        var candidates=Content.Items.Where(u=>CanUpgrade(u.Id)&&!Offers.Contains(u.Id)).Select(u=>u.Id).ToList();var same=candidates.Where(x=>Content.ById[x].Weapon==Content.ById[id].Weapon).ToList();string? replacement=Pick(same.Count>0?same:candidates);
        if(replacement is null)Offers.RemoveAt(index);else Offers[index]=replacement;OfferSelection=-1;if(Offers.Count==0)FinishUpgrade();return true;
    }
    public bool Choose(int index)
    {if(Status!=RunStatus.Upgrading||index<0||index>=Offers.Count||!ApplyUpgrade(Offers[index]))return false;SoundSignals|=SoundCue.Upgrade;FinishUpgrade();return true;}
    public void FinishUpgrade(){Player.Invulnerable=Math.Max(Player.Invulnerable,.65f);Offers=[];OfferSelection=-1;Status=RunStatus.Running;CheckLevel();}
    public void GainXp(float value,bool check=true)
    {
        if(Options.Sandbox)return;float total=value*Growth*XpEfficiency+XpCarry;int whole=(int)MathF.Floor(total+1e-7f);XpCarry=Math.Max(0,total-whole);Xp+=whole;Combat.Xp+=whole;if(check)CheckLevel();
    }
    public void CheckLevel()
    {
        if(Options.Sandbox||Status!=RunStatus.Running||Xp<XpNeed)return;Xp-=XpNeed;Level++;XpNeed=Math.Min(5000,(int)MathF.Ceiling(XpNeed*1.22f+3));
        SoundSignals|=SoundCue.Upgrade;if(!Content.Items.Any(u=>CanUpgrade(u.Id))){Heal(30);return;}DrawOffers();Status=RunStatus.Upgrading;
    }
    public void AwardGold(float value)
    {if(IsTest)return;float total=value*.45f*Greed+GoldCarry;int whole=(int)MathF.Floor(total+1e-7f);GoldEarned+=whole;GoldCarry=Math.Max(0,total-whole);Combat.Gold+=whole;}
    public float Heal(float value){float actual=Math.Max(0,Math.Min(value,Player.MaxHp-Player.Hp));Player.Hp+=actual;Combat.Healing+=actual;return actual;}
    public bool Dash()
    {if(Status!=RunStatus.Running||Player.DashReady>0)return false;SoundSignals|=SoundCue.Dash;if(MoveInput.LengthSquared()>.001f)Player.Facing=Vector2.Normalize(MoveInput);Player.Dash=.22f;Player.DashReady=DashCooldown;Player.Invulnerable=Math.Max(Player.Invulnerable,.3f);return true;}
    public void HurtPlayer(float damage,Enemy? source=null)
    {
        if(damage<=0||Invincible||Player.Invulnerable>0||Status!=RunStatus.Running)return;if(Evolved("laurel"))damage=Math.Min(10,damage);
        if(ShieldCharges>0&&ShieldUntil>Time){SoundSignals|=SoundCue.Shield;ShieldCharges--;Player.Invulnerable=.4f;if(Evolved("laurel"))Explode(Player.Pos,180*Area,70*Power,"laurel",13);return;}
        SoundSignals|=SoundCue.Hurt;float before=Player.Hp;Player.Hp=Math.Max(0,Player.Hp-Math.Max(1,Math.Max(damage*.25f,damage-Armor)));Combat.Hurt+=before-Player.Hp;Player.Invulnerable=.85f;
        if(source is not null){if(source.Def.Slow>0)Player.SlowUntil=Time+source.Def.Slow;var d=source.Pos-Player.Pos;MoveEnemy(source,(d.LengthSquared()>.001f?Vector2.Normalize(d):Vector2.UnitX)*48);}
        if(Player.Hp<=0){if(RevivesUsed<L("revive")+M("revive")){SoundSignals|=SoundCue.Revive;RevivesUsed++;Player.Hp=MathF.Ceiling(Player.MaxHp/2);Player.Invulnerable=3;Player.SlowUntil=0;Notice="ВОЗРОЖДЕНИЕ";}else{SoundSignals|=SoundCue.Death;Status=RunStatus.Dead;}}
    }
    public void RebuildGrid()
    {
        foreach(var cell in grid.Values){cell.Clear();gridPool.Push(cell);}grid.Clear();
        foreach(var e in Enemies)if(e.Alive){int key=(int)MathF.Floor(e.Pos.X/80)+(int)MathF.Floor(e.Pos.Y/80)*1024;if(!grid.TryGetValue(key,out var list))grid[key]=list=gridPool.Count>0?gridPool.Pop():[];list.Add(e);}
    }
    public IEnumerable<Enemy> Near(Vector2 pos,float radius)
    {
        int minX=(int)MathF.Floor((pos.X-radius)/80),maxX=(int)MathF.Floor((pos.X+radius)/80),minY=(int)MathF.Floor((pos.Y-radius)/80),maxY=(int)MathF.Floor((pos.Y+radius)/80);
        for(int y=minY;y<=maxY;y++)for(int x=minX;x<=maxX;x++)if(grid.TryGetValue(x+y*1024,out var cell))foreach(var e in cell)if(e.Alive)yield return e;
    }
    public List<Enemy> Targets(Vector2 pos,float radius=620,int count=2)
    {
        List<Enemy> best=[];List<float> distances=[];
        foreach(var e in Enemies){if(!e.Alive||Arena?.Phase=="locked"&&e.ArenaMember==0)continue;float d=Vector2.DistanceSquared(pos,e.Pos);if(d>=radius*radius)continue;float score=Arena?.BossId==e.Id?-1:d;int i=0;while(i<distances.Count&&distances[i]<score)i++;if(i>=count)continue;best.Insert(i,e);distances.Insert(i,score);if(best.Count>count){best.RemoveAt(count);distances.RemoveAt(count);}}
        return best;
    }
    public Vector2 AimPoint(float range=620)
    {var delta=AimActive?Aim-Player.Pos:Player.Facing*range;float length=delta.Length();return World.Bound(Player.Pos+(length>.001f?delta*Math.Min(length,range)/length:Vector2.Zero),0);}
    public Enemy? AimedTarget(float range=620)
    {var end=AimPoint(range);return Enemies.Where(e=>e.Alive&&(Arena?.Phase!="locked"||e.ArenaMember>0)&&World.SegmentDistance(e.Pos,Player.Pos,end)<e.Radius+24).OrderBy(e=>Vector2.DistanceSquared(e.Pos,end)).FirstOrDefault();}
    private bool WantsFire(string id)=>L(id)>0&&(Manual?SelectedWeapon==id&&(Firing||QueuedWeapon==id):true);
    public void RequestAttack(){if(Status==RunStatus.Running&&Manual)QueuedWeapon=SelectedWeapon;}
    public void SelectSlot(int slot){var ids=Inventory(true);if(slot>=0&&slot<ids.Count){SelectedWeapon=ids[slot];QueuedWeapon=null;}}
    public void SetManual(bool value){Manual=value;Firing=false;QueuedWeapon=null;}
}
