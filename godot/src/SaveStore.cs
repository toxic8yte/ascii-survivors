using System.Text.Json;
using System.Text.Json.Serialization;

namespace AsciiSurvivors;

public sealed class Profile
{
    public int Gold=50,LifetimeGold=50,Runs,Kills,BossKills,ChestsOpened,MaxLevel;
    public double Seconds,BestTime;
    public string Hero="hunter",Map="forest";
    public bool Manual;
    public Dictionary<string,int> Ranks=[],CreditedGross=[],CreditedNet=[];
    public HashSet<string> Heroes=["hunter"],Features=[],Seen=[],Finished=[];
}
public sealed class SaveDocument {public int Version=1;public Profile Profile=new();public Simulation? Run;}
public sealed class SaveStore
{
    public static readonly JsonSerializerOptions JsonOptions=new(){IncludeFields=true,IgnoreReadOnlyProperties=true,PropertyNameCaseInsensitive=true,Converters={new JsonStringEnumConverter()}};
    public SaveDocument Document=new();
    public Profile Profile=>Document.Profile;
    public Simulation? SavedRun=>Document.Run;
    public string LastError="";
    private readonly string file;
    private readonly Catalog content;
    public SaveStore(Catalog content,string file)
    {
        this.content=content;this.file=file;
        foreach(string candidate in new[]{file,file+".bak"})
        {
            if(!File.Exists(candidate))continue;
            try
            {
                if(new FileInfo(candidate).Length>64*1024*1024)throw new InvalidDataException("Save file is too large");
                var saved=JsonSerializer.Deserialize<SaveDocument>(File.ReadAllText(candidate),JsonOptions)??throw new InvalidDataException("Empty save");
                if(saved.Version!=1||saved.Profile.Gold<0||saved.Profile.LifetimeGold<0)throw new InvalidDataException("Unknown save format");
                Document=saved;NormalizeProfile();
                if(Document.Run is {} run)try{run.RepairAfterLoad(content);}catch(Exception e){Document.Run=null;LastError="Профиль сохранён, но бой повреждён: "+e.Message;}
                if(candidate!=file)LastError="Восстановлена резервная копия сохранения";
                return;
            }
            catch(Exception e){LastError="Не удалось прочитать сохранение: "+e.Message;}
        }
        if(File.Exists(file))try{File.Copy(file,file+".corrupt-"+DateTime.UtcNow.ToString("yyyyMMddHHmmss"),false);}catch(IOException){}
        Document=new();
        NormalizeProfile();
    }
    private void NormalizeProfile()
    {
        if(Profile is null||Profile.Gold<0||Profile.LifetimeGold<0||Profile.Heroes is null||Profile.Features is null||Profile.Seen is null||Profile.Ranks is null||Profile.Finished is null||Profile.CreditedGross is null||Profile.CreditedNet is null||!double.IsFinite(Profile.Seconds+Profile.BestTime))throw new InvalidDataException("Invalid profile");
        Profile.Heroes.RemoveWhere(id=>!content.Heroes.ContainsKey(id));Profile.Heroes.Add("hunter");Profile.Features.RemoveWhere(id=>!content.Features.Any(f=>f.Id==id));Profile.Seen.RemoveWhere(id=>!content.Enemies.ContainsKey(id));
        foreach(var u in content.Permanents)Profile.Ranks[u.Id]=Math.Clamp(Profile.Ranks.GetValueOrDefault(u.Id),0,u.Max);
        if(!Profile.Heroes.Contains(Profile.Hero))Profile.Hero="hunter";if(!content.Stages.ContainsKey(Profile.Map))Profile.Map="forest";
    }
    public bool Write()
    {
        string temp=file+".tmp";
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            var bytes=JsonSerializer.SerializeToUtf8Bytes(Document,JsonOptions);
            using(var stream=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None)){stream.Write(bytes);stream.Flush(true);}
            if(File.Exists(file))File.Copy(file,file+".bak",true);
            File.Move(temp,file,true);LastError="";return true;
        }
        catch(Exception e)when(e is IOException or UnauthorizedAccessException or JsonException){LastError="Не удалось сохранить: "+e.Message;return false;}
    }
    private void Bank(Simulation g)
    {
        int gross=Profile.CreditedGross.GetValueOrDefault(g.RunId),net=Profile.CreditedNet.GetValueOrDefault(g.RunId);
        Profile.Gold+=g.GoldAvailable-net;Profile.LifetimeGold+=Math.Max(0,g.GoldEarned-gross);
        Profile.CreditedGross[g.RunId]=g.GoldEarned;Profile.CreditedNet[g.RunId]=g.GoldAvailable;
        Profile.Seen.UnionWith(g.Encountered);
    }
    public bool Checkpoint(Simulation g)
    {
        if(g.IsTest||g.Status is RunStatus.Ready or RunStatus.Dead)return false;
        var previous=CloneProfile();var oldRun=Document.Run;Bank(g);Profile.Hero=g.HeroId;Profile.Map=g.MapId;Profile.Manual=g.Manual;Document.Run=g;
        if(Write())return true;Document.Profile=previous;Document.Run=oldRun;return false;
    }
    public bool Finish(Simulation g)
    {
        if(g.IsTest||g.Elapsed<=0||Profile.Finished.Contains(g.RunId))return false;
        var previous=CloneProfile();var oldRun=Document.Run;Bank(g);Profile.Finished.Add(g.RunId);Profile.Runs++;Profile.Kills+=g.Kills;Profile.BossKills+=g.BossKills;Profile.ChestsOpened+=g.ChestsOpened;Profile.Seconds+=g.Elapsed;Profile.BestTime=Math.Max(Profile.BestTime,g.Elapsed);Profile.MaxLevel=Math.Max(Profile.MaxLevel,g.Level);
        if(Document.Run?.RunId==g.RunId)Document.Run=null;
        if(Write())return true;Document.Profile=previous;Document.Run=oldRun;return false;
    }
    private Profile CloneProfile()=>JsonSerializer.Deserialize<Profile>(JsonSerializer.Serialize(Profile,JsonOptions),JsonOptions)!;
    public bool Reroll(Simulation g)
    {
        int pending=Math.Max(0,g.GoldEarned-Profile.CreditedGross.GetValueOrDefault(g.RunId));
        if(Profile.Gold+pending<g.RerollCost)return false;
        var profile=CloneProfile();var oldRun=Document.Run;var offers=g.Offers;int selected=g.OfferSelection,spent=g.RerollGoldSpent,used=g.RerollsUsed;uint rng=g.RandomState;
        if(!g.Reroll())return false;
        if(Checkpoint(g))return true;
        Document.Profile=profile;Document.Run=oldRun;g.Offers=offers;g.OfferSelection=selected;g.RerollGoldSpent=spent;g.RerollsUsed=used;g.RandomState=rng;return false;
    }
    public bool Purchase(string id,string category)
    {
        var before=CloneProfile();
        if(category=="hero")
        {if(!content.Heroes.TryGetValue(id,out var h)||Profile.Heroes.Contains(id)||Profile.Gold<h.Cost)return false;Profile.Gold-=h.Cost;Profile.Heroes.Add(id);}
        else if(category=="feature")
        {var f=content.Features.FirstOrDefault(x=>x.Id==id);if(f is null||Profile.Features.Contains(id)||Profile.Gold<f.Cost)return false;Profile.Gold-=f.Cost;Profile.Features.Add(id);}
        else
        {var u=content.Permanents.FirstOrDefault(x=>x.Id==id);if(u is null)return false;int rank=Profile.Ranks.GetValueOrDefault(id),cost=u.Cost*(rank+1)*(rank+1);if(rank>=u.Max||Profile.Gold<cost)return false;Profile.Gold-=cost;Profile.Ranks[id]=rank+1;}
        if(Write())return true;Document.Profile=before;return false;
    }
    public bool ImportBrowserProfile(string path)
    {
        var before=Document;
        try
        {
            if(new FileInfo(path).Length>64*1024*1024)throw new InvalidDataException("File too large");using var doc=JsonDocument.Parse(File.ReadAllText(path));var root=doc.RootElement;if(root.TryGetProperty("profile",out var wrapped))root=wrapped;
            if(doc.RootElement.TryGetProperty("Version",out var native)&&native.GetInt32()==1)
            {
                Document=JsonSerializer.Deserialize<SaveDocument>(doc.RootElement.GetRawText(),JsonOptions)??throw new InvalidDataException("Empty backup");NormalizeProfile();Document.Run?.RepairAfterLoad(content);
                if(Write())return true;Document=before;return false;
            }
            if(!root.TryGetProperty("version",out var version)||version.GetInt32()!=2||!root.TryGetProperty("meta",out var meta))throw new InvalidDataException("Нужен экспорт профиля JS-версии");
            var p=new Profile{Gold=meta.GetProperty("gold").GetInt32(),LifetimeGold=meta.GetProperty("lifetimeGold").GetInt32()};if(p.Gold<0||p.LifetimeGold<0)throw new InvalidDataException("Некорректное золото");
            foreach(var row in meta.GetProperty("ranks").EnumerateObject())p.Ranks[row.Name]=row.Value.GetInt32();
            if(root.TryGetProperty("heroes",out var heroes))foreach(var id in heroes.GetProperty("unlocked").EnumerateArray())p.Heroes.Add(id.GetString()!);
            if(root.TryGetProperty("unlocks",out var unlocks))foreach(var id in unlocks.EnumerateArray())p.Features.Add(id.GetString()!);
            if(root.TryGetProperty("seen",out var seen))foreach(var id in seen.EnumerateArray())p.Seen.Add(id.GetString()!);
            if(root.TryGetProperty("character",out var hero))p.Hero=hero.GetString()!;if(root.TryGetProperty("fireMode",out var mode))p.Manual=mode.GetString()=="manual";
            if(root.TryGetProperty("runs",out var runs))p.Runs=Math.Max(0,runs.GetInt32());if(root.TryGetProperty("kills",out var kills))p.Kills=Math.Max(0,kills.GetInt32());if(root.TryGetProperty("bossKills",out var bosses))p.BossKills=Math.Max(0,bosses.GetInt32());if(root.TryGetProperty("chestsOpened",out var chests))p.ChestsOpened=Math.Max(0,chests.GetInt32());if(root.TryGetProperty("maxLevel",out var level))p.MaxLevel=Math.Max(0,level.GetInt32());if(root.TryGetProperty("seconds",out var seconds))p.Seconds=Math.Max(0,seconds.GetDouble());if(root.TryGetProperty("best",out var best)&&best.ValueKind==JsonValueKind.Object)p.BestTime=best.GetProperty("time").GetDouble();
            Document=new(){Profile=p};NormalizeProfile();if(Write())return true;Document=before;return false;
        }
        catch(Exception e)when(e is IOException or JsonException or InvalidOperationException or KeyNotFoundException or InvalidDataException or UnauthorizedAccessException or ArgumentException or NullReferenceException){Document=before;LastError="Импорт не выполнен: "+e.Message;return false;}
    }
}
