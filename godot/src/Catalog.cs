using System.Text.Json;

namespace AsciiSurvivors;

public sealed class ItemDef
{
    public string Id="", Title="", Description="", Icon="", Kind="", Rarity="common", Behavior="";
    public bool Weapon;
    public int Max;
    public float Cooldown, DamageMultiplier=1;
    public int? OfferWeight;
    public ProjectileDef? Projectile;
}
public sealed class ProjectileDef
{
    public float Damage,RankDamage,Speed,Life,Radius,Spread,Charge,SplashRadius,SplashScale;
    public int Pierce,RankPierce,RankCount,Ink;
    public string Glyph="*";
}
public sealed class HeroDef
{
    public string Id="",Name="",Role="",Description="",Weapon="",Sprite="";
    public float Hp,Speed,Magnet,Dash;
    public int Cost,Ink;
    public string[] ExtraWeapons=[];
    public Dictionary<string,float> Traits=[];
    public Dictionary<string,string> FacingSprites=[];
    public float Trait(string key)=>Traits.GetValueOrDefault(key);
}
public sealed class EnemyDef
{
    public string Id="",Title="",Description="",Ai="chase",Role="normal",Rank="normal",Glyph="?",Sprite="";
    public string[] Frames=[];
    public bool Boss,Mega,Roster;
    public int Ink;
    public float Hp,Speed,Radius,Damage,Xp,At,Skill,Slow,Resistance,ProjectileSpeed=175,ProjectileDamageScale=.8f;
    public MovementDef Movement=new();
    public SummonDef? Summon;
}
public sealed class MovementDef
{
    public string Type="chase";
    public float Amplitude=.7f,Frequency=4,TrackingDuration=2,WindupDuration=.4f,ChargeDuration=.5f,RecoveryDuration=1.2f;
}
public sealed class SummonDef {public string Kind="";public int Count;public float Interval;}
public sealed class RecipeDef
{
    public string Id="",Weapon="",Title="",Icon="",Description="";
    public string[] Weapons=[];
    public Dictionary<string,int> Passives=[];
}
public sealed class ShopDef {public string Id="",Title="",Icon="",Description="";public int Cost,Max;}
public sealed class WaveDef {public string Title="";public Dictionary<string,float> Enemies=[];}
public sealed class StageDef {public string Id="",Title="",Description="";public WaveDef[] Waves=[];}

public sealed class Catalog
{
    private static readonly JsonSerializerOptions Options=new(){IncludeFields=true,PropertyNameCaseInsensitive=true};
    public List<ItemDef> Items=[];
    public Dictionary<string,ItemDef> ById=[];
    public Dictionary<string,HeroDef> Heroes=[];
    public Dictionary<string,EnemyDef> Enemies=[];
    public EnemyDef[] ScheduledBosses=[];
    public List<RecipeDef> Recipes=[];
    public List<ShopDef> Permanents=[],Features=[];
    public Dictionary<string,StageDef> Stages=[];
    public static readonly string[] RarityNames=["Обычное","Необычное","Редкое","Эпическое","Легендарное"];
    public static readonly string[] RarityIds=["common","uncommon","rare","epic","legendary"];
    public static readonly int[] RarityWeights=[100,65,35,16,6];
    public static readonly string[] BossOrder=["lichLord","british","freddy","jason","alienQueen","reaper"];
    public static readonly ItemDef[] LightPickups=[new(){Id="pickup:heal",Title="Лечение из костра",Icon="[+]",Description="Исключить лечебные находки из костров."},new(){Id="pickup:gold",Title="Монеты из костра",Icon="◉",Description="Исключить золото из костров. Монеты с врагов остаются."}];
    public static bool IsLightPickup(string id)=>LightPickups.Any(p=>p.Id==id);
    public static Catalog Load(string directory)
        =>Load(file=>File.ReadAllText(Path.Combine(directory,file)));
    public static Catalog Load(Func<string,string> readFile)
    {
        T Read<T>(string file)=>JsonSerializer.Deserialize<T>(readFile(file+".json"),Options)??throw new InvalidDataException(file);
        var c=new Catalog();
        var all=Read<List<ItemDef>>("weapons").Concat(Read<List<ItemDef>>("passives")).ToDictionary(x=>x.Id);
        foreach(var id in Read<Dictionary<string,string[]>>("catalog-order")["upgrades"].Concat(all.Keys).Distinct())c.Items.Add(all[id]);
        c.ById=all;c.Heroes=Read<List<HeroDef>>("heroes").ToDictionary(x=>x.Id);
        c.Enemies=Read<List<EnemyDef>>("enemies-legacy").ToDictionary(x=>x.Id);
        using(var document=JsonDocument.Parse(readFile("enemies.json")))
        foreach(var r in document.RootElement.EnumerateArray())
        {
            var stats=r.GetProperty("stats");var visual=r.GetProperty("visual");var movement=r.GetProperty("movement");
            string S(JsonElement e,string k,string fallback="")=>e.TryGetProperty(k,out var v)?v.GetString()??fallback:fallback;
            float F(JsonElement e,string k,float fallback=0)=>e.TryGetProperty(k,out var v)?v.GetSingle():fallback;
            var rank=S(r,"rank");bool boss=rank is "boss" or "finalBoss";
            var ai=S(movement,"type");ai=ai=="charger"?"charge":ai=="wavy"?"weave":ai;
            var d=new EnemyDef{Id=S(r,"id"),Title=S(r,"name"),Description=S(r,"description"),Rank=rank,Role=S(r,"role"),Roster=true,Boss=boss,Mega=rank=="finalBoss",At=F(r,"firstSecond"),Hp=F(stats,"maxHealth")*(boss?2:4),Damage=F(stats,"damage"),Speed=F(stats,"moveSpeed")*65,Radius=F(stats,"collisionRadius"),Xp=F(stats,"experience"),Resistance=F(stats,"knockbackResistance"),Ai=ai,Skill=ai=="charge"?4.1f:0,Ink=(int)F(visual,"ink"),Glyph=S(visual,"glyph"),Sprite=S(visual,"sprite",S(visual,"glyph")),Movement=JsonSerializer.Deserialize<MovementDef>(movement.GetRawText(),Options)!};
            if(r.TryGetProperty("summon",out var summon))d.Summon=JsonSerializer.Deserialize<SummonDef>(summon.GetRawText(),Options);
            if(visual.TryGetProperty("frames",out var frames))d.Frames=JsonSerializer.Deserialize<string[]>(frames.GetRawText(),Options)!;
            c.Enemies.Add(d.Id,d);
        }
        c.ScheduledBosses=c.Enemies.Values.Where(e=>e.Roster&&e.Boss).OrderBy(e=>e.At).ToArray();
        c.Recipes=Read<List<RecipeDef>>("evolutions");c.Permanents=Read<List<ShopDef>>("permanents");c.Features=Read<List<ShopDef>>("features");c.Stages=Read<List<StageDef>>("stages").ToDictionary(x=>x.Id);
        using(var additions=JsonDocument.Parse(readFile("desktop-additions.json")))
        {
            foreach(var item in JsonSerializer.Deserialize<ItemDef[]>(additions.RootElement.GetProperty("passives").GetRawText(),Options)!){c.Items.Add(item);all.Add(item.Id,item);}
            c.Permanents=JsonSerializer.Deserialize<ShopDef[]>(additions.RootElement.GetProperty("permanents").GetRawText(),Options)!.ToList();
            foreach(var entry in additions.RootElement.GetProperty("heroes").EnumerateObject())
            {var hero=c.Heroes[entry.Name];hero.Sprite=entry.Value.GetProperty("sprite").GetString()!;hero.FacingSprites=JsonSerializer.Deserialize<Dictionary<string,string>>(entry.Value.GetProperty("facingSprites").GetRawText(),Options)!;}
            foreach(var entry in additions.RootElement.GetProperty("bosses").EnumerateObject())
            {var boss=c.Enemies[entry.Name];boss.Sprite=entry.Value.GetString()!;boss.Frames=[];}
        }
        if(c.Heroes.Count!=30||c.Items.Count(x=>x.Weapon)!=33||c.Enemies.Count!=58||c.Recipes.Count!=31)throw new InvalidDataException("Unexpected content counts");
        foreach(var hero in c.Heroes.Values)if(!all.ContainsKey(hero.Weapon))throw new InvalidDataException(hero.Id);
        foreach(var recipe in c.Recipes)if(!all.ContainsKey(recipe.Weapon)||recipe.Passives.Keys.Any(id=>!all.ContainsKey(id)))throw new InvalidDataException(recipe.Id);
        return c;
    }
}
