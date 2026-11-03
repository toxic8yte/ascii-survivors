using System.Numerics;
using System.Text.Json.Serialization;

namespace AsciiSurvivors;

public enum RunStatus {Ready,Running,Paused,Upgrading,Reward,Dead}
public sealed class PlayerState
{
    public Vector2 Pos=new(6400,4800),Prev=new(6400,4800),Facing=Vector2.UnitY;
    public float Hp=100,MaxHp=100,Radius=12,Invulnerable,Dash,DashReady,SlowUntil;
}
public sealed class Enemy
{
    public int Id,ArenaMember;
    public string Kind="";
    [JsonIgnore] public EnemyDef Def=null!;
    [JsonIgnore] public Vector2 CrowdPosition;
    public Vector2 Pos,Prev,Charge,Target;
    public float Hp,MaxHp,Damage,Speed,Radius,Phase,SkillClock,Windup,ChargeTime,Flash,BladeAt=-10,ChilledUntil,FrozenUntil,PoisonAt,BornAt;
    public float HolyUntil,HolyNext,HolyDamage,BurnUntil,BurnNext,BurnDamage;
    public bool Alive=true,TrainingDummy,Pacified;
}
public sealed class Projectile
{
    public string Weapon="",Glyph="*";
    public Vector2 Pos,Prev,Velocity,Origin;
    public float Life,Age,Damage,Radius,Remaining,ChargeLeft,ChargeAngle,MinX,MaxX=12800,MinY,MaxY=9600;
    public int Ink=7;
    public bool Evolved,Returning;
    public Dictionary<int,float> Hits=[];
}
public sealed class Pool
{
    public string Kind="poison",Weapon="poison";
    public Vector2 Pos;
    public float Radius,Life,Damage;
    public bool Home,Acid;
}
public sealed class Blast
{
    public string Weapon="meteor";
    public Vector2 Pos;
    public float Wait,Radius,Damage;
    public int Ink=7;
}
public sealed class Visual
{
    public string Shape="ring",Weapon="",Glyph="*";
    public Vector2 Pos;
    public Vector2[] Points=[];
    public float Life,MaxLife,Radius,Angle,HalfAngle=.95f;
    public int Ink=7;
}
public sealed class Gem
{
    public string Source="";
    public Vector2 Pos;
    public float Value;
    public int Bin;
    public bool Magnetized,Taken,Gold;
}
public sealed class Heart {public Vector2 Pos;public float Value=20,Expires;public bool Taken;public string Source="";}
public sealed class Chest {public int Id;public Vector2 Pos;public string Source="lichLord";public bool CanEvolve,Treasure;}
public sealed class Choice {public string Kind="",Id="";public float Value;public int Rank,Tier;}
public sealed class Encounter
{
    public Vector2 Pos;
    public float Radius=205,WarningLeft=5,LockedLeft=15;
    public string Phase="warning",Kind="lichLord";
    public int BossId;
}
public sealed class CombatStats
{
    public float Damage,Overkill,Hurt,Healing,Xp,Gold;
    public int HeartsDropped,HeartsTaken;
    public Dictionary<string,float> Weapons=[];
    public void Hit(string weapon,float amount,float effective){Damage+=effective;Overkill+=Math.Max(0,amount-effective);Weapons[weapon]=Weapons.GetValueOrDefault(weapon)+effective;}
}
public sealed class RunOptions
{
    public string Hero="hunter",Map="forest",Weapon="starter",Passive="none",Enemy="dummy";
    public int Rank=1,PassiveRank=1,Count=1,EnemyLimit=6000;
    public bool Sandbox,Stress,Manual,Evolved,Invulnerable,Arena=true;
    public Dictionary<string,int> Meta=[];
}
public readonly record struct WaveEntry(string Id,float Weight,bool Ranged,bool Charger,bool Special,bool Elite);
public sealed class WavePlan
{
    public string Title="",Phase="Натиск";
    public int Target,Group,RangedCap,ChargeCap,SpecialCap,EliteCap;
    public float Interval;
    public List<WaveEntry> Entries=[];
}
