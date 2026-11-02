using System.Numerics;

namespace AsciiSurvivors;

public readonly record struct Obstacle(Vector2 Pos,Vector2 Size,string Sprite,int Ink,string Kind);
public readonly record struct PickupBox(int Id,Vector2 Pos,string Kind);
public sealed class World
{
    public const float Width=12800,Height=9600;
    public const int Cols=32,Rows=30;
    public string Map;
    public Obstacle?[] Cells=new Obstacle?[Cols*Rows];
    public List<PickupBox> Treasures=[],Supplies=[];
    private static readonly (string kind,float w,float h,string art,int ink)[] Graves=[("grave",46,46," ._.\n |+|\n_|_|_",1),("rock",60,42," .--.\n/####\\\n\\____/",1),("tree",46,58," \\|/\n--Y--\n  |\n /|\\",3),("crypt",76,54," _____\n|[_+_]|\n|_|||_|",1),("wall",84,30,"[]===[]\n[]===[]",1)];
    private static readonly (string kind,float w,float h,string art,int ink)[] Forest=[("pine",44,58,"  /\\\n /**\\\n/****\\\n  ||",17),("oak",64,58," .oo.\n(oOOo)\n \\||/\n  ||",17),("stump",32,28," _ _\n|o_o|",18),("boulder",60,42," .--.\n/::::\\\n\\____/",1)];
    public World(string map,uint seed)
    {
        Map=map;
        for(int y=0;y<Rows;y++)for(int x=0;x<Cols;x++)
        {
            uint value=Hash((uint)x,(uint)y);if(value%4==0)continue;
            var types=map=="forest"?Forest:Graves;int type=map=="forest"?new[]{0,1,0,1,2,3}[(value>>5)%6]:(int)(value%(uint)types.Length);
            var t=types[type];var pos=new Vector2(x*400+120+value%160,y*320+100+(value>>10)%120);
            if(Vector2.Distance(pos,new(6400,4800))<300||map=="forest"&&Ground(pos)!="grass")continue;
            Cells[y*Cols+x]=new(pos,new(t.w,t.h),t.art,t.ink,t.kind);
        }
        for(int i=0;i<12;i++){uint h=Hash((uint)i+seed%10000,37);var p=new Vector2(600+h%(uint)(Width-1200),600+(h>>12)%(uint)(Height-1200));Resolve(ref p,20,null);Treasures.Add(new(i,p,"treasure"));}
        for(int i=0;i<48;i++)
        {
            uint h=Hash(seed^(uint)i,83),other=Hash(seed^(uint)i,97);string kind=h%10<5?"heal":h%10<8?"magnet":"level";
            var p=new Vector2((i%8+.2f+(h>>8)/16777216f*.6f)*1600,(i/8+.2f+(other>>8)/16777216f*.6f)*1600);
            if(i==27)p=new Vector2(6400,4800)+Direction(h/4294967296f*MathF.Tau)*540;
            Resolve(ref p,20,null);Supplies.Add(new(i,p,kind));
        }
    }
    public static uint Hash(uint x,uint y)
    {
        unchecked{uint v=(x^0x64ab)*374761393^(y^0xf8c)*668265263;v=(v^(v>>13))*1274126177;return v^(v>>16);}
    }
    public static Vector2 Direction(float angle)=>new(MathF.Cos(angle),MathF.Sin(angle));
    public static float Angle(Vector2 p)=>MathF.Atan2(p.Y,p.X);
    public static float AngleDelta(float a)=>MathF.Atan2(MathF.Sin(a),MathF.Cos(a));
    public static float SegmentDistance(Vector2 p,Vector2 a,Vector2 b)
    {Vector2 d=b-a;float t=Math.Clamp(Vector2.Dot(p-a,d)/Math.Max(.00001f,d.LengthSquared()),0,1);return Vector2.Distance(p,a+d*t);}
    public static Vector2 Bound(Vector2 p,float margin=28)=>Vector2.Clamp(p,new(margin,margin),new(Width-margin,Height-margin));
    public static string Ground(Vector2 p)
    {
        float dx=((p.X-6400+1600)%3200+3200)%3200-1600,dy=((p.Y-4800+1200)%2400+2400)%2400-1200;
        if(MathF.Abs(dx)<46||MathF.Abs(dy)<42||dx>=0&&dx<700&&MathF.Abs(dy-520)<32)return "path";
        if(MathF.Pow((dx-940)/190,2)+MathF.Pow((dy+600)/110,2)<1||MathF.Pow((dx-1150)/95,2)+MathF.Pow((dy+300)/60,2)<1)return "water";
        if(MathF.Abs(dx-700)<180&&MathF.Abs(dy-520)<120&&(MathF.Abs(dx-700)>145||MathF.Abs(dy-520)>90))return "flowers";
        return "grass";
    }
    public bool Active(Obstacle b,Encounter? encounter)=>encounter?.Phase!="locked"||Vector2.Distance(b.Pos,encounter.Pos)>encounter.Radius+b.Size.Length()/2+35;
    public bool Resolve(ref Vector2 pos,float radius,Encounter? encounter)
    {
        int col=(int)MathF.Floor(pos.X/400),row=(int)MathF.Floor(pos.Y/320);if(col<0||col>=Cols||row<0||row>=Rows||Cells[row*Cols+col] is not {} b||!Active(b,encounter))return false;
        var lo=b.Pos-b.Size/2;var hi=b.Pos+b.Size/2;var delta=pos-Vector2.Clamp(pos,lo,hi);float distance=delta.Length();if(distance>=radius)return false;
        if(distance>.0001f)pos+=delta/distance*(radius-distance);
        else{float[] d=[pos.X-lo.X,hi.X-pos.X,pos.Y-lo.Y,hi.Y-pos.Y];int side=Array.IndexOf(d,d.Min());if(side==0)pos.X=lo.X-radius;else if(side==1)pos.X=hi.X+radius;else if(side==2)pos.Y=lo.Y-radius;else pos.Y=hi.Y+radius;}
        return true;
    }
    public void Move(ref Vector2 pos,float radius,Vector2 delta,Encounter? encounter,bool inside,bool terrain=true,int detour=0)
    {
        var start=pos;int steps=Math.Max(1,(int)MathF.Ceiling(delta.Length()/8));bool blocked=false;
        for(int i=0;i<steps;i++){pos=Bound(pos+delta/steps);if(terrain)blocked|=Resolve(ref pos,radius,encounter);ResolveRing(ref pos,radius,encounter,inside);}
        if(blocked&&detour!=0&&Vector2.Distance(pos,start)<delta.Length()*.5f)Move(ref pos,radius,new(-delta.Y*detour,delta.X*detour),encounter,inside,terrain);
    }
    public static void ResolveRing(ref Vector2 pos,float radius,Encounter? encounter,bool inside)
    {
        if(encounter?.Phase!="locked")return;var delta=pos-encounter.Pos;float distance=delta.Length();float boundary=inside?encounter.Radius-radius-8:encounter.Radius+radius+8;
        if(inside?distance<=boundary:distance>=boundary)return;pos=encounter.Pos+(distance>.001f?delta/distance:Vector2.UnitX)*boundary;
    }
}
