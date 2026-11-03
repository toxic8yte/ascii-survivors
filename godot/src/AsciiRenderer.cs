using Godot;
using V=System.Numerics.Vector2;

namespace AsciiSurvivors;

public partial class AsciiRenderer : Node2D
{
    public Simulation? Game;
    public Rect2 Field=new(0,136,1440,620);
    public V Camera=new(6400,4800);
    public float Interpolation=1,ProjectionScale=1;
    public string? HighlightedWeapon;
    public int RenderedEnemies;
    public Font Font=new SystemFont{FontNames=["Courier New","Consolas"],FontWeight=500};
    public static readonly Color[] Palette=new[]{"3d5840","82916b","82d2ad","acb77e","cfc7af","ac8db8","df7054","f4c77f","f0edd0","79bace","c6ffdc","ffd0b8","ff8b2b","ff3c52","080b09","389fff","a0dcff","588452","8a7950","4e898b"}.Select(x=>new Color(x)).ToArray();
    private readonly Dictionary<string,TextLine> textCache=[];
    private float cellW=9.6f;
    public Vector2 Screen(V point)=>Field.GetCenter()+new Vector2(point.X-Camera.X,point.Y-Camera.Y)*ProjectionScale;
    public V ToWorld(Vector2 point){var offset=(point-Field.GetCenter())/ProjectionScale;return Camera+new V(offset.X,offset.Y);}
    private int Ink(string weapon,int normal)=>weapon.Length>0&&(weapon==HighlightedWeapon||Game is {} g&&g.Manual&&weapon==g.SelectedWeapon)?13:normal;
    private void Text(Vector2 point,string value,int ink=4,int size=16,bool center=true,float alpha=1)
    {
        if(value.Length==0)return;string key=size+"\0"+value;
        if(!textCache.TryGetValue(key,out var line))
        {
            if(textCache.Count>4096){foreach(var t in textCache.Values)t.Dispose();textCache.Clear();}
            line=new();line.AddString(value,Font,size);textCache[key]=line;
        }
        var color=Palette[Math.Clamp(ink,0,Palette.Length-1)];color.A*=alpha;var pos=point;if(center)pos.X-=line.GetSize().X/2;line.Draw(GetCanvasItem(),pos,color);
    }
    private void Stamp(V point,string value,int ink=4,float alpha=1)
    {
        var screen=Screen(point);if(screen.X<Field.Position.X-80||screen.X>Field.End.X+80||screen.Y<Field.Position.Y-80||screen.Y>Field.End.Y+80)return;
        var lines=value.Split('\n');float height=lines.Length*16*ProjectionScale;int width=lines.Max(x=>x.Length);
        for(int i=0;i<lines.Length;i++)
        {
            var p=screen+new Vector2(-width*cellW*ProjectionScale/2,-height/2+i*16*ProjectionScale);
            if(p.Y<Field.Position.Y||p.Y+16*ProjectionScale>Field.End.Y)continue;
            if(p.X<Field.Position.X||p.X+lines[i].Length*cellW*ProjectionScale>Field.End.X)continue;
            Text(p,lines[i],ink,(int)(16*ProjectionScale),false,alpha);
        }
    }
    private void Line(V start,V end,int ink,string glyph=":",float alpha=1)
    {
        var delta=end-start;int steps=Math.Max(1,(int)MathF.Ceiling(delta.Length()/10));
        for(int i=0;i<=steps;i++)Stamp(start+delta*(i/(float)steps),glyph,ink,alpha);
    }
    private void Circle(V pos,float radius,int ink,string glyph=".",float alpha=1)
    {
        var screen=Screen(pos);if(screen.X+radius*ProjectionScale<Field.Position.X||screen.X-radius*ProjectionScale>Field.End.X||screen.Y+radius*ProjectionScale<Field.Position.Y||screen.Y-radius*ProjectionScale>Field.End.Y)return;
        int count=Math.Clamp((int)(radius*MathF.Tau/12),12,220);for(int i=0;i<count;i++)Stamp(pos+World.Direction(i*MathF.Tau/count)*radius,glyph,ink,alpha);
    }
    private V Interpolated(Enemy e)=>V.Lerp(e.Prev,e.Pos,Interpolation);
    private V Interpolated(Projectile e)=>V.Lerp(e.Prev,e.Pos,Interpolation);
    public override void _Draw()
    {
        if(Game is not {} g)return;RenderedEnemies=0;ProjectionScale=Math.Clamp(Field.Size.X/1440f,.72f,1);cellW=Font.GetStringSize("M",HorizontalAlignment.Left,-1,(int)(16*ProjectionScale)).X/ProjectionScale;
        DrawRect(Field,new Color(g.MapId=="forest"?"10291c":"101b12"));DrawTerrain(g);
        foreach(var pool in g.Pools){int ink=Ink(pool.Weapon,pool.Kind=="water"?9:3);Circle(pool.Pos,pool.Radius,ink,"~",.65f);Stamp(pool.Pos,pool.Kind=="water"?"{~}":"~x~",ink);}
        foreach(var b in g.Blasts){Circle(b.Pos,b.Radius,Ink(b.Weapon,6),":");Stamp(b.Pos,"[!]",Ink(b.Weapon,7));}
        foreach(var v in g.Visuals)DrawVisual(v);
        if(g.L("garlic")>0&&!g.Manual)
        {
            float radius=(75+g.L("garlic")*15)*g.Area*(g.Evolved("garlic")?1.4f:1);
            DrawCenser(V.Lerp(g.Player.Prev,g.Player.Pos,Interpolation),radius,g.Time*2);
        }
        foreach(var shot in g.Shots)
        {
            var pos=Interpolated(shot);int ink=Ink(shot.Weapon,shot.Ink);
            if(shot.ChargeLeft>0){Circle(pos,16+(1-Math.Min(shot.ChargeLeft,1))*16,ink,".");Stamp(pos,"(@)",ink);continue;}
            if(shot.Weapon=="needle")
            {
                var direction=Safe(shot.Velocity);
                Line(pos-direction*30,pos-direction*10,Ink("needle",12),"~");
                Stamp(pos,(int)(g.Time*18+shot.Age*11)%2==0?"{*}":"(*)",Ink("needle",12));
                Stamp(pos,"*",Ink("needle",7));continue;
            }
            if(shot.Weapon=="flamethrower"){Stamp(pos,MathF.Sin(g.Time*25+shot.Age)>0?")}":"{~",ink);Stamp(pos-Safe(shot.Velocity)*24,"~",Ink(shot.Weapon,7));continue;}
            if(shot.Weapon=="poison")ink=3;
            string glyph=shot.Evolved?shot.Weapon switch{"crossbow"=>"|=>","gauss"=>"=G=>","plasmaMinigun"=>"{R}","chozo"=>"(@)","electropistol"=>"~Z>",_=>shot.Glyph}:shot.Glyph;
            Stamp(pos,glyph,ink);
        }
        foreach(var pos in g.BladePositions())Stamp(pos,g.Evolved("blades")?"/+":MathF.Sin(g.Time*4)>0?"/":"\\",Ink("blades",g.Evolved("blades")?9:8));
        foreach(var pos in g.BiblePositions())Stamp(pos,"[B]",Ink("bible",7));
        foreach(var e in g.Enemies)
        {
            if(!e.Alive)continue;var pos=Interpolated(e);var screen=Screen(pos);if(screen.X<Field.Position.X-50||screen.X>Field.End.X+50||screen.Y<Field.Position.Y-70||screen.Y>Field.End.Y+70)continue;
            RenderedEnemies++;var def=e.Def;int ink=e.Flash>0?8:e.ChilledUntil>g.Time||e.FrozenUntil>g.Time?9:def.Ink;
            string art=e.TrainingDummy?" ._.\n[+|+]\n / \\":def.Frames.Length>0?def.Frames[((int)(g.Time*6)+e.Id)%def.Frames.Length]:def.Sprite;
            if(!def.Boss&&def.Rank!="elite"&&g.Enemies.Count>180&&V.Distance(pos,g.Player.Pos)>360)art=def.Glyph;
            Stamp(pos,art,ink);int top=art.Split('\n').Length*8;
            if(def.Ai=="darklord"){Stamp(pos+new V(0,-8),"o o",13);if(e.Windup>0)foreach(float offset in new[]{-.45f,0,.45f})Line(pos,pos+World.Direction(World.Angle(e.Charge)+offset)*4800,13,":",.7f);}
            if(e.HolyUntil>g.Time)Stamp(pos+new V(0,-top-10),"+",Ink("lightStaff",7));
            if(e.BurnUntil>g.Time)Stamp(pos+new V(-16,-top-10),"*",Ink("flamethrower",12));
            if(e.Hp<e.MaxHp&&e.MaxHp>70)Stamp(pos+new V(0,-top-12),new string('-',Math.Clamp((int)MathF.Ceiling(e.Hp/e.MaxHp*5),1,5)),6);
            if(e.Windup>0)
            {
                Stamp(pos+new V(0,-top-26),"!",7);
                if(def.Ai=="blink"){Circle(e.Target,32,6,"!");Stamp(e.Target,"[!]",7);}
                if(def.Ai=="charge")
                {
                    var attack=g.ChargeAttack(e);float distance=attack.Speed*attack.Duration*(e.ChilledUntil>g.Time?.4f:1),half=e.Radius+g.Player.Radius;
                    foreach(float offset in new[]{-half,0,half}){var start=pos+new V(-e.Charge.Y,e.Charge.X)*offset;Line(start,start+e.Charge*distance,12,offset==0?"=":":");}
                    Stamp(pos+e.Charge*distance,MathF.Abs(e.Charge.X)>MathF.Abs(e.Charge.Y)?e.Charge.X>0?">>":"<<":e.Charge.Y>0?"vv":"^^",12);
                }
            }
        }
        foreach(var shot in g.EnemyShots)Stamp(Interpolated(shot),shot.Glyph,shot.Ink);
        foreach(var gem in g.Gems)Stamp(gem.Pos,gem.Value>=6?"<*>":"*",16);
        foreach(var heart in g.Hearts)Stamp(heart.Pos,"[+]",11);
        foreach(var chest in g.Chests){Stamp(chest.Pos,chest.CanEvolve?" ___ \n[E*]\n|__|":" ___ \n[?*]\n|__|",chest.CanEvolve?5:7);Stamp(chest.Pos-new V(0,36),(int)(g.Time*3)%2==1?"*":"+",8);}
        if(!g.Options.Sandbox)foreach(var cache in g.MapWorld.Treasures)if(!g.TreasuresTaken.Contains(cache.Id))Stamp(cache.Pos,"[X]",7);
        if(!g.IsTest)foreach(var box in g.MapWorld.Supplies)if(!g.SuppliesTaken.Contains(box.Id))Stamp(box.Pos," ___ \n| "+(box.Kind=="heal"?"+":box.Kind=="level"?"^":"U")+" |\n|___|",box.Kind=="heal"?11:box.Kind=="level"?7:16);
        if(g.Arena is {} arena)
        {
            bool warning=arena.Phase=="warning";Circle(arena.Pos,arena.Radius*(warning?.85f+.15f*(1-arena.WarningLeft/5):1),warning?7:6,warning?":":"#");
            var boss=g.Enemies.FirstOrDefault(e=>e.Id==arena.BossId);string label=warning?$"КОЛЬЦО ЧЕРЕЗ {MathF.Ceiling(arena.WarningLeft)} С":$"БОСС: {MathF.Ceiling(boss?.Hp??0)} HP · СТЕНА: {MathF.Ceiling(arena.LockedLeft)} С";
            Text(new(Field.GetCenter().X,Field.Position.Y+38),label,7,13);
        }
        var player=g.Player;var playerPos=V.Lerp(player.Prev,player.Pos,Interpolation);string facing=MathF.Abs(player.Facing.X)>MathF.Abs(player.Facing.Y)?player.Facing.X>0?"right":"left":player.Facing.Y>0?"down":"up";
        string sprite=g.Hero.FacingSprites.GetValueOrDefault(facing,g.Hero.Sprite);
        if(player.Invulnerable<=0||(int)(g.Time*16)%2==0)Stamp(playerPos,sprite,player.Dash>0?10:g.Hero.Ink);
        if(g.ShieldCharges>0&&g.ShieldUntil>g.Time){Circle(playerPos,42,9,"+");Stamp(playerPos-new V(0,44),"["+g.ShieldCharges+"]",9);}
        if(g.Manual&&g.AimActive)Stamp(g.Aim,"+",13);
        Text(new(Field.Position.X+24,Field.Position.Y+14),g.Content.Stages[g.MapId].Title.ToUpperInvariant()+" · 12800 × 9600",1,11,false);
        Text(new(Field.End.X-190,Field.Position.Y+14),$"{(int)player.Pos.X} : {(int)player.Pos.Y}",1,11,false);
        Text(new(Field.Position.X+24,Field.End.Y-30),player.DashReady<=0?"[ПРОБЕЛ] РЫВОК ГОТОВ":$"[ПРОБЕЛ] РЫВОК {player.DashReady:0.0} С",7,12,false);
        for(float y=Field.Position.Y;y<Field.End.Y;y+=3)DrawRect(new Rect2(Field.Position.X,y,Field.Size.X,1),new Color(0,0,0,.055f));
    }
    private static V Safe(V point)=>point.LengthSquared()>.0001f?V.Normalize(point):V.UnitX;
    private void DrawTerrain(Simulation g)
    {
        var topLeft=ToWorld(Field.Position);var bottomRight=ToWorld(Field.End);
        void Patch(V pos,V size,Color color){var screen=Screen(pos);var rect=new Rect2(screen-new Vector2(size.X,size.Y)*ProjectionScale/2,new Vector2(size.X,size.Y)*ProjectionScale).Intersection(Field);if(rect.HasArea())DrawRect(rect,color);}
        if(g.MapId=="forest")
        {
            for(int i=-2;i<8;i++){float x=6400+i*3200;if(x>=topLeft.X-46&&x<=bottomRight.X+46)Patch(new(x,Camera.Y),new(92,Field.Size.Y/ProjectionScale),new Color("343824"));float y=4800+i*2400;if(y>=topLeft.Y-42&&y<=bottomRight.Y+42)Patch(new(Camera.X,y),new(Field.Size.X/ProjectionScale,84),new Color("343824"));}
        }
        for(int y=(int)MathF.Floor(topLeft.Y/80)-1;y<=bottomRight.Y/80+1;y++)for(int x=(int)MathF.Floor(topLeft.X/80)-1;x<=bottomRight.X/80+1;x++)
        {
            uint h=World.Hash((uint)x,(uint)y);V pos=new(x*80+h%40,y*80+(h>>8)%40);string kind=g.MapId=="forest"?World.Ground(pos):"grass";
            if(kind=="water")Stamp(pos,"~",19,.65f);else if(kind=="flowers")Stamp(pos,h%2==0?"*":"+",3,.6f);else if(h%3==0)Stamp(pos,h%2==0?".":"'",0,.7f);
        }
        if(g.Options.Sandbox)return;
        int minX=Math.Clamp((int)(topLeft.X/400),0,World.Cols-1),maxX=Math.Clamp((int)(bottomRight.X/400),0,World.Cols-1),minY=Math.Clamp((int)(topLeft.Y/320),0,World.Rows-1),maxY=Math.Clamp((int)(bottomRight.Y/320),0,World.Rows-1);
        for(int y=minY;y<=maxY;y++)for(int x=minX;x<=maxX;x++)if(g.MapWorld.Cells[y*World.Cols+x] is {} b&&g.MapWorld.Active(b,g.Arena))Stamp(b.Pos,b.Sprite,b.Ink,.7f);
    }
    private void DrawVisual(Visual v)
    {
        int ink=Ink(v.Weapon,v.Ink);float alpha=Math.Clamp(v.Life/Math.Max(.01f,v.MaxLife)*2,0,1);
        if(v.Weapon=="garlic")
        {if(Game?.Manual==true)DrawCenser(v.Pos,v.Radius,Game.Time*2,alpha);return;}
        if(v.Shape is "arc" or "beam"){for(int i=1;i<v.Points.Length;i++)Line(v.Points[i-1],v.Points[i],ink,v.Shape=="beam"?"~":"+",alpha);return;}
        if(v.Shape=="whip")
        {float reveal=Math.Min(1,(1-v.Life/v.MaxLife)*4+.25f)*(v.Points.Length-1);for(int i=1;i<=MathF.Ceiling(reveal);i++){float t=Math.Min(1,reveal-i+1);Line(v.Points[i-1],V.Lerp(v.Points[i-1],v.Points[i],t),ink,"~",alpha);}return;}
        if(v.Shape=="crowbar")
        {float angle=v.Angle+(2*(1-v.Life/v.MaxLife)-1)*v.HalfAngle;var dir=World.Direction(angle);Line(v.Pos+dir*12,v.Pos+dir*v.Radius,ink,"/",alpha);Stamp(v.Pos+dir*v.Radius,"J",ink,alpha);return;}
        if(v.Shape=="fist"){float reach=v.Radius*(.3f+.7f*MathF.Sin(MathF.PI*Math.Clamp(1-v.Life/v.MaxLife,0,1)));Stamp(v.Pos+World.Direction(v.Angle)*reach,v.Glyph,ink,alpha);return;}
        if(v.Shape=="slash"){for(float a=-.95f;a<=.95f;a+=.13f)Stamp(v.Pos+World.Direction(v.Angle+a)*v.Radius,v.Glyph,ink,alpha);return;}
        if(v.Shape=="pentagram"){var points=Enumerable.Range(0,5).Select(i=>v.Pos+World.Direction(i*MathF.Tau/5-MathF.PI/2)*v.Radius).ToArray();for(int i=0;i<5;i++)Line(points[i],points[(i+2)%5],ink,"*",alpha);return;}
        Circle(v.Pos,v.Radius,ink,v.Glyph,alpha);
    }
    private void DrawCenser(V center,float radius,float angle,float alpha=1)
    {
        int ink=Ink("garlic",7);var censer=center+World.Direction(angle)*radius*.65f;
        Circle(center,radius,Ink("garlic",3),".",alpha*.55f);
        Line(center,censer,Ink("garlic",1),":",alpha);
        Stamp(censer,Game?.Evolved("garlic")==true?"(G)":"(g)",ink,alpha);
        Stamp(censer+new V(0,-21),MathF.Sin(angle*3)>0?"~":"'",Ink("garlic",4),alpha*.8f);
    }
    public override void _ExitTree(){foreach(var line in textCache.Values)line.Dispose();textCache.Clear();}
}
