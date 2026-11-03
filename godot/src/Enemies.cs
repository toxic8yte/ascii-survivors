using System.Numerics;

namespace AsciiSurvivors;

public sealed partial class Simulation
{
    private static string RoleOf(EnemyDef e)=>e.Roster?e.Role:e.Ai is "ranged" or "summoner" or "blink"?"special":"normal";
    public WavePlan GetWave()
    {
        float age=PressureTime;int minute=(int)(age/60);int stage=age<60?0:age<180?1:age<360?2:age<480?3:age<600?4:age<900?5:age<1200?6:age<1800?7:5+minute%3;
        string[] titles=["Первые шорохи","Мёртвая поступь","Голодная стая","Охота началась","Железная процессия","Красная жатва","Ночной дозор","Бездонный натиск"];
        string[][] order=[["fast","heavy","special"],["heavy","fast","special"],["fast","special","heavy"],["fast","special","heavy"],["heavy","special","fast"],["fast","special","heavy"],["special","heavy","fast"],["heavy","fast","special"]];
        float[][] weights=[[34,28,18,10,4],[30,28,20,18,4],[34,24,30,15,5],[14,20,34,28,20],[12,18,28,38,24],[30,23,36,26,6],[26,24,28,32,7],[33,22,34,36,7]];
        var available=Content.Enemies.Values.Where(e=>!e.Boss&&(e.Roster?e.At<=age:e.At<=age*.65f)).ToList();List<EnemyDef> selected=[];
        foreach(string role in (age>=360&&!Options.Stress?new[]{"normal"}:new[]{"swarm","normal"}).Concat(order[stage]))
        {var pool=available.Where(e=>e.Roster&&e.Role==role).OrderByDescending(e=>e.At).ToList();if(pool.Count>0&&selected.Count<4)selected.Add(pool[(minute/3)%Math.Min(2,pool.Count)]);}
        var old=available.Where(e=>!e.Roster).ToList();if(old.Count>0)selected.Add(old[minute%old.Count]);if(selected.Count==0)selected.Add(Content.Enemies["grave_rat"]);
        WaveDef? wave=null;var map=Content.Stages[MapId];if(!Options.Stress&&map.Waves.Length>0){int m=(int)(Time/60);wave=map.Waves[m<30?m:24+m%6];selected=wave.Enemies.Keys.Select(id=>Content.Enemies[id]).ToList();}
        HashSet<string> support=[];
        if(!Options.Stress&&Time>=45)foreach(string ai in new[]{"ranged","charge"})
        {if(selected.Any(e=>e.Ai==ai))continue;var pool=Content.Enemies.Values.Where(e=>!e.Boss&&e.Ai==ai&&e.At<=Time).ToList();if(pool.Count>0){var e=pool[(int)(((uint)(Time/20)+Seed)%(uint)pool.Count)];selected.Add(e);support.Add(e.Id);}}
        bool surge=!Options.Stress&&minute>=2&&age%60<10,recovery=!Options.Stress&&minute>=2&&age%60>=48,danger=!Options.Stress&&age>=360;float after=Math.Max(0,age-360);
        float population=Options.Stress?18+Math.Min(age,1800)*.12f+Math.Max(0,age-1800)*.1f:24+Math.Min(age,360)*.35f+after*2.25f;
        int target=Math.Min(Options.Stress?24000:2000,(int)MathF.Round(population*(surge?(age>=360?1.25f:1.12f):recovery?.9f:1)));
        var plan=new WavePlan{Title=wave?.Title??titles[stage],Phase=Options.Stress?"Нагрузочный тест":surge?"Наплыв":recovery?"Передышка":"Натиск",Target=target,
            Interval=Options.Stress?Math.Max(.24f,.85f-age/4000):Math.Max(.15f,.85f-Math.Min(age,360)/1200-after/900)*(surge?.8f:recovery?1.35f:1),
            Group=Options.Stress?Math.Min(8,2+(int)(age/180)):Math.Max(3,Math.Min(32,3+(int)(Math.Min(age,360)/60)+(int)(after/20)+(surge?2:recovery?-2:0))),
            RangedCap=Math.Max(1,Math.Min(danger?18:8,(int)(target*(danger?.07f:.06f)))),ChargeCap=Math.Max(1,Math.Min(danger?8:4,(int)(target*.03f))),SpecialCap=Math.Max(3,Math.Min(danger?70:40,(int)(target*(danger?.18f:.14f)))),EliteCap=Math.Max(1,Math.Min(danger?45:28,(int)(target*(danger?.09f:.04f))))};
        foreach(var e in selected){int roleIndex=Array.IndexOf(new[]{"swarm","normal","fast","heavy","special"},RoleOf(e));float w=support.Contains(e.Id)?e.Ai=="ranged"?20:16:wave is not null?wave.Enemies[e.Id]:e.Ai=="ranged"?danger?12:5:roleIndex<0?6:weights[stage][roleIndex];plan.Entries.Add(new(e.Id,w,e.Ai=="ranged",e.Ai=="charge",RoleOf(e)=="special",e.Rank=="elite"));}
        return plan;
    }
    private string PickEnemy(List<WaveEntry> entries)
    {float r=Random()*entries.Sum(e=>e.Weight);foreach(var e in entries){r-=e.Weight;if(r<0)return e.Id;}return entries[^1].Id;}
    public Enemy Spawn(string kind,Vector2? position=null,int member=0)
    {
        var d=Content.Enemies[kind];Vector2 pos=position??World.Bound(Player.Pos+World.Direction(Random()*MathF.Tau)*(SpawnRadius+Random()*100));
        float pressure=!d.Boss&&!IsTest?1+Math.Max(0,PressureTime-360)/300:1;
        float scale=Options.Sandbox?1:(d.Mega?1+Math.Max(0,Time-600)/1200:1+WaveAge/340)*pressure;
        var e=new Enemy{Id=NextId++,Kind=kind,Def=d,Pos=pos,Prev=pos,Hp=d.Hp*scale,MaxHp=d.Hp*scale,Damage=d.Damage*(Options.Sandbox?1:1+(int)(PressureTime/180)*.12f),Speed=d.Speed,Radius=d.Radius,Phase=Random()*MathF.Tau,SkillClock=1.5f+Random()*2,Target=pos,ArenaMember=member,BornAt=Time};
        if(d.Ai=="direct")e.Charge=SafeDirection(Player.Pos-pos);if(!Options.Sandbox)MapWorld.Resolve(ref e.Pos,e.Radius,Arena);World.ResolveRing(ref e.Pos,e.Radius,Arena,member>0);e.Prev=e.Pos;Enemies.Add(e);Encountered.Add(kind);if(d.Boss)SoundSignals|=SoundCue.Boss;return e;
    }
    public void SpawnWave()
    {
        var plan=GetWave();int reserve=Arena?.Phase=="warning"?1:0,count=Math.Min(Options.EnemyLimit-Enemies.Count-reserve,Options.Stress?Math.Min(128,2+(int)(WaveAge/45)):Math.Min(plan.Group,Math.Max(0,plan.Target-Enemies.Count)));
        int ranged=Enemies.Count(e=>e.Alive&&!e.Def.Boss&&e.Def.Ai=="ranged"),charge=Enemies.Count(e=>e.Alive&&!e.Def.Boss&&e.Def.Ai=="charge"),special=Enemies.Count(e=>e.Alive&&!e.Def.Boss&&RoleOf(e.Def)=="special"),elite=Enemies.Count(e=>e.Alive&&!e.Def.Boss&&e.Def.Rank=="elite");
        string? stressKind=Options.Stress?PickEnemy(plan.Entries):null;
        for(int i=0;i<count;i++){var choices=Options.Stress?plan.Entries:plan.Entries.Where(e=>(!e.Ranged||ranged<plan.RangedCap)&&(!e.Charger||charge<plan.ChargeCap)&&(!e.Special||special<plan.SpecialCap)&&(!e.Elite||elite<plan.EliteCap)).ToList();if(choices.Count==0)break;var e=Spawn(stressKind??PickEnemy(choices));if(e.Def.Ai=="ranged")ranged++;if(e.Def.Ai=="charge")charge++;if(RoleOf(e.Def)=="special")special++;if(e.Def.Rank=="elite")elite++;}
        SpawnClock+=Options.Stress?Math.Max(.12f,.86f-WaveAge*.0014f):plan.Interval;
    }
    public void SpawnSandbox()
    {
        bool known=Content.Enemies.TryGetValue(Options.Enemy,out var definition),ring=known&&definition!.Boss&&Options.Arena;int count=ring?1:Options.Count;
        if(ring){Player.Pos=Vector2.Clamp(Player.Pos,new(ArenaRadius+90),new(World.Width-ArenaRadius-90,World.Height-ArenaRadius-90));Player.Prev=Player.Pos;}
        for(int i=0;i<count;i++)
        {
            var e=Spawn(known?Options.Enemy:"ghoul",Player.Pos+World.Direction(count==1?0:i*MathF.Tau/count)*(count==1?150:180));
            if(!known){e.TrainingDummy=true;e.Hp=e.MaxHp=10000;e.Damage=e.Speed=0;}
            if(ring){Arena=new(){Pos=Player.Pos,Radius=ArenaRadius,Phase="locked",WarningLeft=0,LockedLeft=15,BossId=e.Id,Kind=e.Kind};e.ArenaMember=1;World.ResolveRing(ref e.Pos,e.Radius,Arena,true);e.Prev=e.Pos;Player.Invulnerable=1;LastBoss=e.Def.Title;}
        }
        RebuildGrid();
    }
    public bool FirstBoss(Enemy e)=>BossIndex==1&&e.Def.Boss&&e.Kind==Catalog.BossOrder[0];
    public float BossHealth(int index)=> (index==1?1500:3200+Math.Max(0,index-2)*1000)+Math.Max(0,Level-1)*200;
    public void BeginEncounter(){SoundSignals|=SoundCue.Boss;Arena=new(){Pos=Player.Pos,Radius=ArenaRadius,Kind=Catalog.BossOrder[BossIndex%Catalog.BossOrder.Length]};Notice="ПЯТЬ СЕКУНД ДО ЗАМЫКАНИЯ КОЛЬЦА";}
    private void UpdateEncounter(float dt)
    {
        if(Arena is not {} arena)return;
        if(arena.Phase=="locked"){arena.LockedLeft=Math.Max(0,arena.LockedLeft-dt);if(arena.LockedLeft<=0)ReleaseArena("СТЕНА ИСЧЕЗЛА · БОСС ОСТАЛСЯ");return;}
        arena.Pos=Vector2.Clamp(Player.Pos,new(arena.Radius+90),new(World.Width-arena.Radius-90,World.Height-arena.Radius-90));arena.WarningLeft-=dt;if(arena.WarningLeft>0)return;
        arena.Phase="locked";World.ResolveRing(ref Player.Pos,Player.Radius,arena,true);
        foreach(var e in Enemies){e.ArenaMember=0;World.ResolveRing(ref e.Pos,e.Radius,arena,false);}
        var boss=Spawn(arena.Kind,arena.Pos+World.Direction(Random()*MathF.Tau)*arena.Radius*.56f,1);bool first=BossIndex==0;
        boss.Hp=boss.MaxHp=BossHealth(BossIndex+1);boss.Damage*=first?.65f:.75f;boss.Radius=Math.Min(46,boss.Radius*1.25f);if(first)boss.SkillClock=1.2f;
        arena.BossId=boss.Id;BossIndex++;Player.Invulnerable=Math.Max(Player.Invulnerable,1);LastBoss=boss.Def.Title;Notice="БОСС: "+LastBoss;
    }
    public void ReleaseArena(string notice)
    {if(Arena is null)return;Arena=null;NextBossAt=PressureTime+90;foreach(var e in Enemies)e.ArenaMember=0;if(!Options.Sandbox)MapWorld.Resolve(ref Player.Pos,Player.Radius,null);Player.Invulnerable=Math.Max(Player.Invulnerable,1.5f);Notice=notice;}
    public void MoveEnemy(Enemy e,Vector2 delta,bool detour=false)=>MapWorld.Move(ref e.Pos,e.Radius,delta,Arena,e.ArenaMember>0,!Options.Sandbox,detour?(e.Id%2==0?-1:1):0);
    private static Vector2 SafeDirection(Vector2 p)=>p.LengthSquared()>.000001f?Vector2.Normalize(p):Vector2.UnitX;
    private readonly List<(string Kind,Vector2 Pos,int Member)> summons=[];
    private void QueueSummons(Enemy e,string kind,int count)
    {
        if(e.ArenaMember>0&&Arena?.Phase=="locked"){int inside=Enemies.Count(x=>x.Alive&&x.ArenaMember>0&&!x.Def.Boss)+summons.Count(x=>x.Member>0);count=Math.Min(count,Math.Max(0,(FirstBoss(e)?2:4)-inside));}
        for(int i=0;i<count&&summons.Count<24;i++)summons.Add((kind,World.Bound(e.Pos+World.Direction(Random()*MathF.Tau)*(55+Random()*40)),e.ArenaMember));
    }
    public (float Speed,float Duration,float Warning) ChargeAttack(Enemy e)=>(e.Def.Boss?380:340,e.Def.Roster?e.Def.Movement.ChargeDuration:e.Def.Boss?.65f:.45f,e.Def.Roster?Math.Max(.8f,e.Def.Movement.WindupDuration):e.Def.Boss?1:.85f);
    private void EnemySkill(Enemy e)
    {
        var d=e.Def;
        if(d.Ai=="darklord")
        {
            float angle=World.Angle(e.Charge),radius=4800;
            foreach(float offset in new[]{-.45f,0,.45f}){var dir=World.Direction(angle+offset);Visuals.Add(new(){Shape="beam",Pos=e.Pos,Points=[e.Pos,e.Pos+dir*radius],Life=.4f,MaxLife=.4f,Radius=radius,Ink=13,Glyph="~"});var delta=Player.Pos-e.Pos;float along=Vector2.Dot(delta,dir);if(along>0&&along<radius&&MathF.Abs(delta.X*dir.Y-delta.Y*dir.X)<Player.Radius+18)HurtPlayer(e.Damage);}
            if(EnemyShots.Count>216)EnemyShots.RemoveRange(0,EnemyShots.Count-216);
            for(int i=0;i<40;i++){var velocity=World.Direction(i*MathF.Tau/20+(i>=20?.12f:0))*(i<20?135:95);EnemyShots.Add(new(){Pos=e.Pos,Prev=e.Pos,Velocity=velocity,Life=7,Damage=e.Damage*.6f,Radius=7,Ink=13,Glyph="o"});}
        }
        else if(d.Ai=="ranged")
        {
            float angle=World.Angle(Player.Pos-e.Pos);int count=e.Kind=="lich"||FirstBoss(e)?1:3;
            for(int i=0;i<count&&EnemyShots.Count<256;i++)EnemyShots.Add(new(){Pos=e.Pos,Prev=e.Pos,Velocity=World.Direction(angle+(i-(count-1)/2f)*.22f)*d.ProjectileSpeed,Life=4,Damage=e.Damage*d.ProjectileDamageScale,Radius=7,Ink=d.Ink,Glyph=e.Kind=="pumpkin"?"o":"~"});
            if(e.Kind=="lichLord")QueueSummons(e,"skeleton",FirstBoss(e)?2:3);
        }
        else if(d.Ai=="summoner"){QueueSummons(e,"ghoul",3);QueueSummons(e,"mummy",1);}
        else if(d.Ai=="blink"){e.Pos=e.Target;MoveEnemy(e,Vector2.Zero);e.Prev=e.Pos;}
        else if(d.Ai=="charge"){e.ChargeTime=ChargeAttack(e).Duration;if(e.Kind=="alienQueen")QueueSummons(e,"alien",2);}
    }
    private void UpdateEnemy(Enemy e,float dt)
    {
        if(e.TrainingDummy||e.FrozenUntil>Time){e.Flash=Math.Max(0,e.Flash-dt);return;}
        var def=e.Def;var delta=Player.Pos-e.Pos;float distance=Math.Max(1,delta.Length());var direction=delta/distance;
        if(!def.Boss&&distance>SpawnRadius*(def.Ai=="direct"?2.8f:4)){e.Alive=false;return;}
        if(def.Boss&&e.ArenaMember==0&&distance>SpawnRadius*3){e.Pos=World.Bound(Player.Pos+World.Direction(Random()*MathF.Tau)*(SpawnRadius+100));MoveEnemy(e,Vector2.Zero);e.Prev=e.Pos;return;}
        float slow=e.ChilledUntil>Time?.4f:1,late=def.Boss||IsTest?1:1+Math.Min(.15f,Math.Max(0,PressureTime-360)/1200),speed=e.Speed*Math.Min(1.85f,1+WaveAge/750)*late*slow;
        if(def.Roster)
        {
            var m=def.Movement;speed=e.Speed*Math.Min(1.5f,1+PressureTime/6000)*late*slow;
            if(m.Type=="direct")direction=e.Charge;
            else if(m.Type=="wavy"){float wave=MathF.Sin(Time*m.Frequency+e.Phase)*m.Amplitude;direction=new((delta.X-delta.Y*wave)/distance,(delta.Y+delta.X*wave)/distance);}
            else if(m.Type=="orbit"){float radial=Math.Clamp((distance-180)/180,-.6f,1),side=MathF.Sin(e.Phase)>=0?1:-1;direction=new(direction.X*radial-direction.Y*side,direction.Y*radial+direction.X*side);}
        }
        else if(def.Ai=="weave"){float weave=MathF.Sin(Time*5+e.Phase)*.7f;direction+=new Vector2(-delta.Y/distance*weave,delta.X/distance*weave);}
        if(def.Ai=="ranged")speed*=distance>380?1:distance<(FirstBoss(e)?140:230)?-.65f:0;
        e.SkillClock=Math.Max(0,e.SkillClock-dt);
        if(def.Summon is {} summon&&e.SkillClock==0){QueueSummons(e,summon.Kind,summon.Count);e.SkillClock=summon.Interval;}
        if(def.Roster&&def.Ai=="charge"&&e.SkillClock>def.Movement.TrackingDuration)speed=0;
        if(e.Windup>0){speed=0;e.Windup=Math.Max(0,e.Windup-dt);if(e.Windup==0)EnemySkill(e);}
        else if(e.ChargeTime>0){e.ChargeTime=Math.Max(0,e.ChargeTime-dt);direction=e.Charge;speed=ChargeAttack(e).Speed*slow;if(def.Roster&&e.ChargeTime==0)e.SkillClock=def.Movement.RecoveryDuration+def.Movement.TrackingDuration;}
        else if(def.Skill>0&&e.SkillClock<=0&&distance<(def.Ai=="charge"?620:850))
        {
            e.SkillClock=FirstBoss(e)?3.5f:def.Skill;e.Windup=def.Ai=="charge"?ChargeAttack(e).Warning:def.Roster?def.Movement.WindupDuration:def.Ai=="darklord"?1.6f:def.Ai=="blink"?.95f:def.Boss?.8f:.6f;e.Charge=direction;
            e.Target=World.Bound(Player.Pos+World.Direction(Random()*MathF.Tau)*150);speed=0;
        }
        MoveEnemy(e,direction*speed*dt,e.ChargeTime<=0);e.Flash=Math.Max(0,e.Flash-dt);
    }
    public void HurtEnemy(Enemy e,float amount,float knockback=0,string weapon="other")
    {
        if(!e.Alive)return;SoundSignals|=SoundCue.Hit;if(weapon is "blades" or "bible")SoundSignals|=SoundCue.Orbit;float damage=amount*(Content.ById.TryGetValue(weapon,out var item)?item.DamageMultiplier:1);float effective=Math.Min(e.Hp,damage);Combat.Hit(weapon,damage,effective);
        if(weapon=="poison"&&Hero.Trait("lifesteal")>0)LeechBudget-=Heal(Math.Min(LeechBudget,Math.Min(1,effective*Hero.Trait("lifesteal"))));
        e.Hp-=damage;e.Flash=.12f;if(knockback>0){float resistance=e.Def.Resistance>0?e.Def.Resistance:FirstBoss(e)?.65f:0;MoveEnemy(e,SafeDirection(e.Pos-Player.Pos)*knockback*(1-resistance));}
        if(e.Hp>0)return;SoundSignals|=e.Def.Boss?SoundCue.BossDeath:SoundCue.Kill;e.Alive=false;Kills++;
        if(Options.Sandbox){if(Arena?.BossId==e.Id)ReleaseArena("БОСС ПОБЕЖДЁН · ТЕСТ");return;}
        if(Kills%5==0)AwardGold(1);
        if(e.Def.Boss){BossKills++;AwardGold(e.Def.Mega?125:25);if(Arena?.BossId==e.Id)ReleaseArena("БОСС ПОБЕЖДЁН · ЗАБЕРИ СУНДУК");else Notice="БОСС ПОБЕЖДЁН · ЗАБЕРИ СУНДУК";NextBossAt=Math.Max(NextBossAt,PressureTime+90);Chests.Add(new(){Id=NextChestId++,Pos=e.Pos,Source=e.Kind,CanEvolve=e.Def.Mega||e.BornAt>=600});if(Chests.Count>64)Chests.RemoveAt(0);}
        if(e.Def.Xp>0&&(e.Def.Boss||Options.Stress||Random()<.5f))AddGem(e.Pos,e.Def.Xp);
        if(!IsTest&&Random()<(e.Def.Boss?.275f:.009625f*Luck)){Hearts.Add(new(){Pos=e.Pos+new Vector2(14,0),Value=e.Def.Boss?60:20,Expires=Time+120});Combat.HeartsDropped++;}
    }
}
