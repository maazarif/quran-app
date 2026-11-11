import numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
from skimage import measure, morphology
im=np.asarray(Image.open('/mnt/user-data/attachments/4321288f-b32d-5eae-b43e-b495976a0547/0acbd254-image.jpg').convert('RGB')).astype(float)
OX,OY=300,300
reg=im[OY:740, OX:760]; R,G,B=reg[...,0],reg[...,1],reg[...,2]
gold=(R+G)/2-B
goldcol=reg[gold>128].mean(0); print('gold colour', goldcol.round(), (gold>95).sum())
gm=(abs(R-G)<12)&(abs(G-B)<14)&(R>48)
graycol=reg[gm&(R>58)].mean(0); print('grey colour', graycol.round())

# --- stand: two bars, each a parallelogram with vertical ends
ys,xs=np.nonzero(gm)
def fit(sel_windows):
    m=np.zeros_like(gm)
    for (x0,x1,y0,y1) in sel_windows: m[y0:y1,x0:x1]=gm[y0:y1,x0:x1]
    yy,xx=np.nonzero(m)
    A=np.vstack([xx,np.ones_like(xx)]).T
    slope=np.linalg.lstsq(A,yy,rcond=None)[0][0]
    off=yy-slope*xx
    return slope, np.percentile(off,1.5), np.percentile(off,98.5)
b1=fit([(30,95,165,265),(285,352,300,400)])   # upper-left to lower-right
b2=fit([(345,408,165,265),(88,150,300,400)])   # upper-right to lower-left
print('bar1',b1,'bar2',b2)
def ends(slope,lo,hi):
    # pixels belonging to this bar: between its two long edges
    off=ys-slope*xs; sel=(off>=lo-1)&(off<=hi+1)
    x=xs[sel]; return np.percentile(x,0.3), np.percentile(x,99.7)
bars=[]
for b in (b1,b2):
    s,lo,hi=b; xa,xb=ends(*b)
    pts=[(xa,s*xa+lo),(xb,s*xb+lo),(xb,s*xb+hi),(xa,s*xa+hi)]
    bars.append([(x,y) for x,y in pts])
print('bars',[[tuple(round(v,1) for v in p) for p in b] for b in bars])

# --- gold letters: sub-pixel contours of the gold map
import sys
f=ndi.gaussian_filter(np.clip(gold,0,None),0.35)
Z=4; fz=ndi.zoom(f,Z,order=3)
level=float(sys.argv[1]) if len(sys.argv)>1 else 80
cs=[c[:,::-1]/Z for c in measure.find_contours(fz,level)]
cs=[measure.approximate_polygon(c,0.12) for c in cs if len(c)>12]
# drop tiny specks (noise) but keep real dots
def area(c): x,y=c[:,0],c[:,1]; return abs(np.dot(x,np.roll(y,1))-np.dot(y,np.roll(x,1)))/2
cs=[c for c in cs if area(c)>0.8]
print('gold contours',len(cs))

# --- dark shape under the letters (covers the stand): closed, filled outline of the gold
gb=f>40
sil=morphology.closing(gb,morphology.disk(7)); sil=ndi.binary_fill_holes(sil); sil=morphology.dilation(sil,morphology.disk(2))
sz=ndi.zoom(ndi.gaussian_filter(sil.astype(float),2.0),Z,order=1)
sc=max(measure.find_contours(sz,0.5),key=len)[:,::-1]/Z
sc=measure.approximate_polygon(sc,0.3)
json.dump({'gold':goldcol.tolist(),'grey':graycol.tolist(),'bars':bars,'letters':[c.tolist() for c in cs],'sil':sc.tolist(),'w':reg.shape[1],'h':reg.shape[0]},open('trace.json','w'))
