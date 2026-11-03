using System.Numerics;

namespace AsciiSurvivors;

public sealed partial class Simulation
{
    [System.Text.Json.Serialization.JsonIgnore] private readonly HashSet<int> liveHitIds=[];
    [System.Text.Json.Serialization.JsonIgnore] private readonly List<int> staleHitIds=[];
    public void CompactHitHistory()
    {
        liveHitIds.Clear();foreach(var enemy in Enemies)if(enemy.Alive)liveHitIds.Add(enemy.Id);
        foreach(var shot in Shots)if(shot.Hits.Count>64)
        {
            staleHitIds.Clear();foreach(var hit in shot.Hits)if(!liveHitIds.Contains(hit.Key))staleHitIds.Add(hit.Key);
            foreach(int id in staleHitIds)shot.Hits.Remove(id);
        }
        liveHitIds.Clear();staleHitIds.Clear();
    }
    public void Ring(string weapon,Vector2 pos,float radius,float life=.45f,int ink=7,string glyph="*"){if(Enemies.Count>=4000&&weapon.Length>0)life=Math.Min(life,.18f);Visuals.Add(new(){Weapon=weapon,Pos=pos,Radius=radius,Life=life,MaxLife=life,Ink=ink,Glyph=glyph});}
    public void Arc(string weapon,Vector2[] points,float life=.24f,int ink=15)=>Visuals.Add(new(){Shape="arc",Weapon=weapon,Points=points,Life=life,MaxLife=life,Ink=ink});
    public void Explode(Vector2 pos,float radius,float damage,string weapon,int ink=7,float knockback=18)
    {SoundSignals|=SoundCue.Explosion;Ring(weapon,pos,radius,.45f,ink);foreach(var e in Near(pos,radius+50))if(Vector2.Distance(e.Pos,pos)<radius+e.Radius)HurtEnemy(e,damage,knockback,weapon);}
    public IEnumerable<Vector2> BladePositions()
    {
        int count=!Manual&&L("blades")>0?L("blades")+Amount+(Evolved("blades")?2:0):0;
        for(int i=0;i<count;i++)yield return Player.Pos+World.Direction(Time*3.2f*Haste*ProjectileSpeed/.85f+i*MathF.Tau/count)*(Evolved("blades")?118:88)*Area;
    }
    public IEnumerable<Vector2> BiblePositions()
    {
        if(L("bible")==0||BibleUntil<=Time&&!(!Manual&&Evolved("bible")))yield break;
        int count=1+L("bible")+Amount+(Evolved("bible")?2:0);float radius=(Evolved("bible")?170:135)*Area;
        for(int i=0;i<count;i++)yield return Player.Pos+World.Direction(Time*2.7f*ProjectileSpeed+i*MathF.Tau/count)*radius;
    }
    public float Cooldown(string id)
    {
        int level=L(id);bool evolved=Evolved(id);
        if(id=="needle")return .68f*.85f/Haste/(1+.05f*Math.Max(0,level-1))*(evolved?.4f:1);
        float basic=id switch{"clock"=>1.1f,"blades"=>.65f,"pulse"=>5,"lightning"=>2.4f,"boomerang"=>evolved?.7f:1.7f,"frost"=>4.2f,"meteor"=>3.2f,"poison"=>.75f,_=>Content.ById[id].Cooldown};
        float rapid=evolved&&id is "dagger" or "pentagram" or "pistol"?id=="pistol"?.5f:.4f:1;
        return basic*rapid*.85f/Haste/(Content.ById[id].Cooldown>0?1+(level-1)*.05f:1);
    }
    public void Cast(string id)
    {
        int before=Shots.Count+Pools.Count+Blasts.Count+Visuals.Count;float protectedUntil=BibleUntil+ShieldUntil;
        CastWeapon(id);
        if(Shots.Count+Pools.Count+Blasts.Count+Visuals.Count>before||BibleUntil+ShieldUntil>protectedUntil)SoundSignals|=WeaponSound(id);
    }
    private void CastWeapon(string id)
    {
        if(L(id)<=0)return;int level=L(id);bool evolved=Evolved(id);Vector2 p=Player.Pos;var target=Manual?(Vector2?)AimPoint():AutoAimPoint();
        float angle=target is {} point?World.Angle(point-p):World.Angle(Player.Facing);
        if(id=="needle")
        {
            var closest=Manual?(Vector2?)AimPoint(700):AutoAimPoint(700);if(closest is null)return;angle=World.Angle(closest.Value-p);
            for(int i=0;i<1+Amount;i++){float spread=i==0?0:MathF.Ceiling(i/2f)*.11f*(i%2==1?-1:1);Shots.Add(new(){Weapon=id,Evolved=evolved,Pos=p,Prev=p,Velocity=World.Direction(angle+spread)*490*ProjectileSpeed,Life=1.5f*Duration,Radius=5*Area,Remaining=1+L("pierce")+(evolved?3:0),Damage=20*(1+.18f*Math.Max(0,level-1))*Power*(evolved?2:1),Glyph="*",Ink=7});}return;
        }
        if(id=="pulse")
        {float radius=(145+level*18)*Area*(evolved?1.5f:1);Ring(id,p,radius,.55f,7,"+");foreach(var e in Near(p,radius+35))if(Vector2.Distance(e.Pos,p)<radius+e.Radius){HurtEnemy(e,(36+level*20)*Power*(evolved?1.8f:1),75,id);if(evolved)e.ChilledUntil=Time+7*Duration;}return;}
        if(id=="blades")
        {
            float radius=(110+level*10)*Area;int count=1+Amount+(evolved?2:0);List<float> swings=[];
            for(int i=0;i<count;i++){float a=angle+(i-(count-1)/2f)*.25f;swings.Add(a);Visuals.Add(new(){Shape="slash",Weapon=id,Pos=p,Angle=a,Radius=radius,Life=.22f,MaxLife=.22f,Ink=8,Glyph="/"});}
            foreach(var e in Near(p,radius+35))if(Vector2.Distance(e.Pos,p)<radius+e.Radius){float facing=World.Angle(e.Pos-p);int hits=swings.Count(a=>MathF.Abs(World.AngleDelta(facing-a))<=.95f);if(hits>0)HurtEnemy(e,(23+level*5)*Power*hits*(evolved?1.5f:1),18,id);}return;
        }
        if(id=="poison")
        {Pools.Add(new(){Pos=Manual?AimPoint(360):p,Radius=(58+level*5)*Area,Life=(4+level*.5f)*Duration*(evolved?1.8f:1),Acid=evolved});return;}
        if(id=="lightning")
        {
            for(int chain=0;chain<1+Amount;chain++)
            {
                var from=p;HashSet<int> visited=[];List<Vector2> points=[p];var starts=Manual?[]:Targets(p,620,1+Amount);
                for(int i=0;i<2+level;i++)
                {
                    var e=i==0?(Manual?AimedTarget():starts.Count>0?starts[chain%starts.Count]:null):Targets(from,260,2+level).FirstOrDefault(e=>!visited.Contains(e.Id));if(e is null)break;
                    visited.Add(e.Id);if(chain>0)points.Add((from+e.Pos)/2+new Vector2(-(e.Pos-from).Y,(e.Pos-from).X)*((chain%2==1?1:-1)*14*MathF.Ceiling(chain/2f)/Math.Max(1,Vector2.Distance(from,e.Pos))));
                    from=e.Pos;points.Add(from);HurtEnemy(e,(24+8*level)*Power,0,id);if(evolved&&Blasts.Count<100)Blasts.Add(new(){Weapon=id,Pos=from,Wait=.4f,Radius=55*Area,Damage=(24+8*level)*Power,Ink=15});
                }
                if(points.Count==1&&(Manual||target is not null)){var end=Manual?AimPoint():target!.Value;if(chain>0)points.Add((p+end)/2+new Vector2(-(end-p).Y,(end-p).X)*(chain*14/Math.Max(1,Vector2.Distance(p,end))));points.Add(end);}
                if(points.Count>1)Arc(id,points.ToArray());
            }
            return;
        }
        if(id=="boomerang")
        {
            if(evolved){Explode(p,230*Area,(46+level*14)*Power,id,13,42);return;}if(target is null)return;int count=1+level/3+Amount;
            for(int i=0;i<count;i++)Shots.Add(new(){Weapon=id,Pos=p,Prev=p,Velocity=World.Direction(angle+(i-(count-1)/2f)*.22f)*370*ProjectileSpeed,Life=2.5f,Damage=(14+7*level)*Power,Radius=16*Area,Remaining=100000,Returning=true,Glyph="<)>",Ink=7});return;
        }
        if(id=="frost")
        {float radius=(170+level*20)*Area*(evolved?1.4f:1);Ring(id,p,radius,.65f,9,"*");foreach(var e in Near(p,radius+35))if(Vector2.Distance(e.Pos,p)<radius+e.Radius){e.ChilledUntil=Time+(.8f+level*.2f)*Duration;if(evolved)e.FrozenUntil=Time+(e.Def.Mega?.35f:e.Def.Boss?.6f:1.5f*Duration);HurtEnemy(e,(8+level*6)*Power*(evolved?2:1),0,id);}return;}
        if(id=="meteor"||id=="hammer")
        {
            int count=(id=="hammer"?1+level/2:level>=3?2:1)+Amount+(id=="meteor"&&evolved?2:0);float reach=id=="hammer"?130*Area:620;var targets=Targets(p,reach,count);
            for(int i=0;i<count&&Blasts.Count<100;i++){Vector2 pos;if(Manual)pos=AimPoint(reach)+(id=="meteor"?new Vector2((i-(count-1)/2f)*55,0):Vector2.Zero);else if(targets.Count>0)pos=targets[i%targets.Count].Pos;else if(target is {} fire&&Vector2.Distance(fire,p)<=reach)pos=fire;else break;Blasts.Add(new(){Weapon=id,Pos=World.Bound(pos),Wait=id=="hammer"?.3f:.65f,Radius=(id=="hammer"?70+level*10:90+level*12)*Area*(id=="meteor"&&evolved?1.4f:1),Damage=(id=="hammer"?36+level*16:48+level*22)*Power});}return;
        }
        var ballistic=Content.ById[id].Projectile;
        if(ballistic is not null)
        {
            int count=Math.Min(12,1+Amount+(id=="chozo"?(int)Hero.Trait("chozoAmount"):0)+(ballistic.RankCount>0?level/ballistic.RankCount:0));
            for(int i=0;i<count&&Shots.Count<12512;i++)
            {float a=angle+(i>0?MathF.Ceiling(i/2f)*(i%2==1?1:-1)*ballistic.Spread:0);Shots.Add(new(){Weapon=id,Evolved=evolved,Pos=p,Prev=p,Velocity=World.Direction(a)*ballistic.Speed*ProjectileSpeed,Life=ballistic.Life*Duration,Damage=(ballistic.Damage+ballistic.RankDamage*level)*Power,Radius=ballistic.Radius*Area*(id=="chozo"?1+(level-1)*.15f:1),ChargeLeft=ballistic.Charge>0?Math.Max(.12f,(ballistic.Charge-(level-1)*.12f)/Haste*(evolved?.75f:1)):0,ChargeAngle=a,Remaining=ballistic.Pierce+ballistic.RankPierce*level+L("pierce")+(evolved&&id=="crossbow"?2:0),Glyph=ballistic.Glyph,Ink=ballistic.Ink});}return;
        }
        if(id=="lightStaff")
        {float radius=(240+level*20)*Area;Ring(id,p,radius,.7f,7,"+");foreach(var e in Near(p,radius+50))if(Vector2.Distance(e.Pos,p)<radius+e.Radius){if(evolved&&!e.Def.Boss){e.Windup=0;e.SkillClock=Math.Max(e.SkillClock,1);}HurtEnemy(e,(20+level*10)*Power,5,id);if(e.Alive){e.HolyUntil=Time+4*Duration;e.HolyNext=e.HolyNext>Time?e.HolyNext:Time+.5f;e.HolyDamage=(5+level*3)*Power;}}return;}
        if(id=="crowbar"||id=="gauntlets")
        {
            float radius=id=="crowbar"?(48+level*4)*Math.Min(Area,1.5f):(90+level*10)*Area;int count=(id=="crowbar"?1:2)+Amount;List<Visual> swings=[];
            for(int i=0;i<count;i++){var swing=new Visual{Weapon=id,Shape=id=="crowbar"?"crowbar":"fist",Pos=p,Angle=angle+(i-(count-1)/2f)*(id=="crowbar"?.22f:.14f),Radius=radius+(id=="gauntlets"?i%2*10:0),Life=id=="crowbar"?.2f:.28f,MaxLife=id=="crowbar"?.2f:.28f,Ink=id=="crowbar"?12:8,Glyph=id=="crowbar"?"J":"[=]",HalfAngle=.85f};swings.Add(swing);Visuals.Add(swing);}
            foreach(var e in Near(p,radius+60)){int hits=swings.Count(s=>Vector2.Distance(e.Pos,p)<s.Radius+e.Radius&&MathF.Abs(World.AngleDelta(World.Angle(e.Pos-p)-s.Angle))<s.HalfAngle);if(hits>0)HurtEnemy(e,(id=="crowbar"?24+level*12:12+level*8)*Power*hits,id=="crowbar"?40:55,id);}
            if(evolved&&id=="crowbar")EnemyShots.RemoveAll(s=>Vector2.Distance(s.Pos,p)<=radius+s.Radius&&MathF.Abs(World.AngleDelta(World.Angle(s.Pos-p)-angle))<.85f);
            if(evolved&&id=="gauntlets"){float reach=Math.Min(220,radius+80);var a=p+World.Direction(angle)*radius*.6f;var b=p+World.Direction(angle)*reach;Arc(id,[a,b],.25f,8);foreach(var e in Near(p,reach+50))if(World.SegmentDistance(e.Pos,a,b)<e.Radius+22)HurtEnemy(e,(12+level*8)*Power*.45f,85,id);}return;
        }
        if(id=="laurel"){ShieldCharges=1+level/2;ShieldUntil=Time+(3+level)*Duration*WeaponQuality(id);return;}
        if(id=="bible"){BibleUntil=Time+(2+level*.4f)*Duration;return;}
        if(id=="water")
        {
            for(int i=0;i<1+level/2+Amount&&Pools.Count<500;i++){float a=angle+i*.6f,d=target is {} t?Math.Min(330,Vector2.Distance(t,p)):180;Pools.Add(new(){Weapon=id,Kind=id,Pos=World.Bound(p+World.Direction(a)*d),Radius=(60+level*9)*Area,Life=(3+level*.4f)*Duration*(evolved?1.4f:1),Damage=(9+level*6)*Power,Home=evolved});}return;
        }
        if(id is "birds" or "ebony")
        {
            int count=(evolved?4:1)+Amount;for(int i=0;i<count&&Blasts.Count<100;i++){float a=Time*(id=="ebony"?-.8f:.8f)+(id=="ebony"?MathF.PI:0)+i*.32f;var pos=Manual&&target is {} t?t:p+World.Direction(a)*220;Blasts.Add(new(){Weapon=id,Pos=World.Bound(pos+new Vector2(i*30,0)),Wait=.6f,Radius=(65+level*8)*Area*(evolved?1.35f:1),Damage=(20+level*10)*Power*(evolved?1.6f:1),Ink=id=="ebony"?5:9});}return;
        }
        if(id=="whip")
        {
            float radius=(155+level*20)*Area,thickness=14*Area;List<Vector2[]> paths=[];
            for(int i=0;i<2+Amount;i++){int side=i%2==1?-1:1;float offset=i<2?0:(i%2==1?1:-1)*MathF.Ceiling((i-1)/2f)*48*Area;var path=Enumerable.Range(0,9).Select(j=>{float t=j/8f;return p+new Vector2(side*radius*t,offset-MathF.Sin(MathF.PI*t)*radius*.18f);}).ToArray();paths.Add(path);Visuals.Add(new(){Shape="whip",Weapon=id,Points=path,Pos=p,Radius=radius,Life=.28f,MaxLife=.28f,Ink=9,Glyph="~"});}
            float healing=0;foreach(var e in Near(p,radius+(Amount+1)*48*Area+50)){int hits=paths.Count(path=>Enumerable.Range(1,path.Length-1).Any(i=>World.SegmentDistance(e.Pos,path[i-1],path[i])<=e.Radius+thickness));if(hits==0)continue;bool critical=evolved&&Random()<Math.Min(.8f,.3f*Luck);HurtEnemy(e,(25+15*level)*Power*(evolved?1.5f:1)*(critical?2.5f:1)*hits,25,id);if(critical)healing+=5;}Heal(Math.Min(healing,3));return;
        }
        if(id=="clock")
        {
            var end=p+World.Direction(angle)*480*Area;Arc(id,[p,end],.3f,15);
            foreach(var e in Near(p,480*Area+50))if(World.SegmentDistance(e.Pos,p,end)<=e.Radius+22)
            {float freeze=(1.2f+level*.2f)*Duration*WeaponQuality(id);if(e.Def.Boss)freeze=Math.Min(freeze,Math.Min(e.Def.Mega?.2f:.35f,Cooldown(id)*.6f));e.FrozenUntil=Time+freeze;}
            if(++ClockStep%12==0&&evolved){Ring(id,p,650*Area,.8f,9,"0");foreach(var e in Near(p,650*Area+50))if(Vector2.Distance(e.Pos,p)<650*Area+e.Radius)HurtEnemy(e,e.Def.Boss?Math.Min(450,e.Hp*.05f):e.Hp*.5f,0,id);}return;
        }
        if(id is "garlic" or "pentagram")
        {
            float radius=(id=="pentagram"?650:75+level*15)*Area*(evolved&&id=="garlic"?1.4f:1),healing=0;Ring(id,p,radius,.45f,7,id=="pentagram"?"*":".");if(id=="pentagram")Visuals[^1].Shape="pentagram";
            foreach(var e in Near(p,radius+50))if(Vector2.Distance(e.Pos,p)<=radius+e.Radius){HurtEnemy(e,(id=="pentagram"?e.Def.Boss?110+40*level:60+35*level:4+4*level)*Power*(evolved?1.5f:1),id=="garlic"?14:25,id);if(evolved&&id=="garlic")healing++;}Heal(Math.Min(healing,.5f));if(id=="pentagram"&&evolved)foreach(var gem in Gems)gem.Magnetized=true;return;
        }
        int total=Math.Min(12,1+level/2+Amount+(evolved&&id=="axe"?5:evolved?2:0));
        for(int i=0;i<total&&Shots.Count<12512;i++)
        {
            float a=evolved&&id=="axe"?angle+i*MathF.Tau/total:(id=="dagger"&&!Manual?World.Angle(Player.Facing):angle)+(i-(total-1)/2f)*.16f;
            float speed=(id=="pistol"?800:id=="sling"?480:id=="dagger"?700:id=="axe"?240:id=="fireball"?220:330)*ProjectileSpeed;var velocity=World.Direction(a)*speed;
            if(id=="axe"&&!evolved){var axeTarget=Manual?AimPoint(420):target??AimPoint(420);var delta=axeTarget-p;float distance=Math.Max(1,delta.Length()),scale=Math.Min(1,420/distance),flight=Math.Clamp(Math.Min(420,distance)/speed,.2f,1.75f),spread=a-angle;var ballisticVelocity=new Vector2(delta.X*scale/flight,delta.Y*scale/flight-180*flight);velocity=new(ballisticVelocity.X*MathF.Cos(spread)-ballisticVelocity.Y*MathF.Sin(spread),ballisticVelocity.X*MathF.Sin(spread)+ballisticVelocity.Y*MathF.Cos(spread));}
            Shots.Add(new(){Weapon=id,Evolved=evolved,Pos=p,Prev=p,Velocity=velocity,Life=(id=="rune"?4:2.5f)*Duration,Damage=(id=="fireball"?45+20*level:id=="axe"?30+18*level:12+8*level)*Power*(evolved?1.8f:1),Radius=(id=="fireball"?15:8)*Area,Remaining=id is "rune" or "axe"||evolved&&id=="fireball"?100000:1+L("pierce")+level/2,MinX=Math.Max(28,p.X-500),MaxX=Math.Min(World.Width-28,p.X+500),MinY=Math.Max(28,p.Y-300),MaxY=Math.Min(World.Height-28,p.Y+300),Ink=id=="fireball"?12:7,Glyph=id=="axe"?"/P":id=="sling"?"o":id=="rune"?"<#>":"-->"});
        }
    }
    private void UpdateWeapons(float dt)
    {
        foreach(var item in Content.Items.Where(x=>x.Weapon&&L(x.Id)>0))
        {
            string id=item.Id;Clocks[id]=Math.Max(0,Clocks.GetValueOrDefault(id)-dt);if(id=="blades"&&!Manual)continue;
            if(Clocks[id]<=0&&WantsFire(id)){Cast(id);if(QueuedWeapon==id)QueuedWeapon=null;Clocks[id]=Cooldown(id);}
        }
        for(int shotIndex=0,shotCount=Shots.Count;shotIndex<shotCount;shotIndex++)
        {
            var s=Shots[shotIndex];
            if(s.Life<=0||s.Remaining<=0)continue;
            if(s.ChargeLeft>0){s.ChargeLeft=Math.Max(0,s.ChargeLeft-dt);s.Pos=s.Prev=Player.Pos;if(s.ChargeLeft>0)continue;}
            if(s.Evolved&&s.Weapon=="chozo"){var target=Near(s.Pos,290).Where(e=>!s.Hits.ContainsKey(e.Id)&&Vector2.Distance(e.Pos,s.Pos)<240).OrderBy(e=>Vector2.DistanceSquared(e.Pos,s.Pos)).FirstOrDefault();if(target is not null){float a=World.Angle(s.Velocity),delta=World.AngleDelta(World.Angle(target.Pos-s.Pos)-a);s.Velocity=World.Direction(a+Math.Clamp(delta,-dt*3,dt*3))*s.Velocity.Length();}}
            s.Prev=s.Pos;s.Life-=dt;if(s.Life<=0)continue;s.Age+=dt;if(s.Weapon=="axe"&&!s.Evolved)s.Velocity.Y+=360*dt;
            if(s.Returning&&s.Age>=.65f){var delta=Player.Pos-s.Pos;if(delta.Length()<24){s.Life=0;continue;}s.Velocity=SafeDirection(delta)*570*ProjectileSpeed;}
            s.Pos+=s.Velocity*dt;
            if(s.Weapon=="rune"){bool bounced=false;if(s.Pos.X<s.MinX||s.Pos.X>s.MaxX){s.Velocity.X*=-1;s.Pos.X=Math.Clamp(s.Pos.X,s.MinX,s.MaxX);bounced=true;}if(s.Pos.Y<s.MinY||s.Pos.Y>s.MaxY){s.Velocity.Y*=-1;s.Pos.Y=Math.Clamp(s.Pos.Y,s.MinY,s.MaxY);bounced=true;}if(bounced&&s.Evolved)Explode(s.Pos,80*Area,s.Damage*.6f,s.Weapon,9);}
            var deltaMove=s.Pos-s.Prev;
            foreach(var e in Near((s.Pos+s.Prev)/2,deltaMove.Length()/2+s.Radius+50))
            {
                if(!e.Alive||s.Remaining<=0||s.Hits.TryGetValue(e.Id,out float until)&&Time<until||World.SegmentDistance(e.Pos,s.Prev,s.Pos)>=e.Radius+s.Radius)continue;
                s.Hits[e.Id]=Time+(s.Returning?.4f:s.Weapon=="rune"?.35f:100);s.Remaining--;bool critical=s.Evolved&&s.Weapon=="pistol"&&Random()<Math.Min(.75f,.3f*Luck);
                HurtEnemy(e,s.Damage*(critical?3:s.Evolved&&s.Weapon=="sling"&&e.Def.Boss?2:1),s.Returning?4:s.Weapon=="sling"?24:s.Weapon=="needle"?9:7,s.Weapon);
                var b=Content.ById[s.Weapon].Projectile;if(b?.SplashRadius>0)Explode(e.Pos,b.SplashRadius*Area,s.Damage*b.SplashScale,s.Weapon,b.Ink,8);
                if(!s.Evolved)continue;
                if(s.Weapon=="crossbow"&&e.Alive)e.FrozenUntil=Time+(e.Def.Boss?.15f:.65f*Duration);
                if(s.Weapon=="gauss")Explode(e.Pos,60*Area,s.Damage*.25f,s.Weapon,9,8);
                if(s.Weapon=="plasmaMinigun"&&!e.Alive)Explode(e.Pos,70*Area,s.Damage*.6f,s.Weapon,10);
                if(s.Weapon=="flamethrower"&&e.Alive){e.BurnUntil=Time+2.5f*Duration;if(e.BurnNext<=Time)e.BurnNext=Time+.5f;e.BurnDamage=Math.Max(e.BurnDamage,s.Damage*.35f);}
                if(s.Weapon=="electropistol")
                {
                    List<Vector2> points=[e.Pos];var from=e;
                    for(int jump=0;jump<2;jump++){var other=Near(from.Pos,200).Where(n=>!s.Hits.ContainsKey(n.Id)&&Vector2.Distance(n.Pos,from.Pos)<150).OrderBy(n=>Vector2.DistanceSquared(n.Pos,from.Pos)).FirstOrDefault();if(other is null)break;s.Hits[other.Id]=Time+100;points.Add(other.Pos);HurtEnemy(other,s.Damage*(jump>0?.35f:.55f),0,s.Weapon);from=other;}if(points.Count>1)Arc(s.Weapon,points.ToArray(),.22f,15);
                }
                if(s.Weapon is "fireball" or "sling")Explode(e.Pos,80*Area,s.Damage*.4f,s.Weapon,s.Weapon=="sling"?7:12);
            }
        }
        Shots.RemoveAll(s=>s.Life<=0||s.Remaining<=0||s.Pos.X<0||s.Pos.Y<0||s.Pos.X>World.Width||s.Pos.Y>World.Height);
        foreach(var pos in BladePositions())foreach(var e in Near(pos,50+19*Area))if(Time-e.BladeAt>.35f*.85f&&Vector2.Distance(e.Pos,pos)<e.Radius+19*Area){e.BladeAt=Time;HurtEnemy(e,(23+L("blades")*5)*Power*(Evolved("blades")?1.8f:1),13,"blades");}
        foreach(var pos in BiblePositions())foreach(var e in Near(pos,50+20*Area))if(Time>=BibleHits.GetValueOrDefault(e.Id)&&Vector2.Distance(e.Pos,pos)<e.Radius+20*Area){BibleHits[e.Id]=Time+.35f;HurtEnemy(e,(15+L("bible")*8)*Power*(Evolved("bible")?1.6f:1),22,"bible");}
        foreach(var pool in Pools)
        {
            pool.Life-=dt;if(pool.Life<=0)continue;if(pool.Home){var d=Player.Pos-pool.Pos;pool.Pos+=SafeDirection(d)*Math.Min(d.Length(),35*dt);pool.Radius=Math.Min(180*Area,pool.Radius+dt*8);}
            foreach(var e in Near(pool.Pos,pool.Radius+35))if(Time>=(pool.Kind=="water"?WaterHits.GetValueOrDefault(e.Id):e.PoisonAt)&&Vector2.Distance(e.Pos,pool.Pos)<pool.Radius+e.Radius){if(pool.Kind=="water")WaterHits[e.Id]=Time+.4f;else e.PoisonAt=Time+.4f;HurtEnemy(e,pool.Kind=="water"?pool.Damage:(5+L("poison")*3)*Power*(pool.Acid?2:1),0,pool.Weapon);if(pool.Acid)e.ChilledUntil=Time+1;}
        }
        Pools.RemoveAll(p=>p.Life<=0);
        foreach(var e in Enemies.Where(e=>e.Alive))
        {
            if(e.HolyUntil>Time&&Time>=e.HolyNext){e.HolyNext=Time+.5f;HurtEnemy(e,e.HolyDamage*(Evolved("lightStaff")&&e.Hp<e.MaxHp*.5f?1.5f:1),0,"lightStaff");}
            if(e.Alive&&e.BurnUntil>=Time&&Time>=e.BurnNext){e.BurnNext=Time+.5f;HurtEnemy(e,e.BurnDamage,0,"flamethrower");}
        }
        foreach(var blast in Blasts){blast.Wait-=dt;if(blast.Wait<=0)Explode(blast.Pos,blast.Radius,blast.Damage,blast.Weapon,blast.Ink,blast.Weapon=="hammer"?48:24);}
        Blasts.RemoveAll(b=>b.Wait<=0);
        if(Steps%60==0){CompactHitHistory();foreach(int key in BibleHits.Where(x=>x.Value<=Time).Select(x=>x.Key).ToArray())BibleHits.Remove(key);foreach(int key in WaterHits.Where(x=>x.Value<=Time).Select(x=>x.Key).ToArray())WaterHits.Remove(key);}
    }
}
