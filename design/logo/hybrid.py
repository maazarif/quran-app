import json, base64, io, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
im=np.asarray(Image.open('/mnt/user-data/attachments/4321288f-b32d-5eae-b43e-b495976a0547/0acbd254-image.jpg').convert('RGB')).astype(float)
reg=im[300:740,300:760]; R,G,B=reg[...,0],reg[...,1],reg[...,2]
gold=(R+G)/2-B
d=json.load(open('trace.json'))
# bright gold, from the strongest gold pixels
gc=reg[gold>130].mean(0); print('gold', gc.round())
# calligraphy as a gold layer: colour from the image (so shading stays), alpha from how gold each pixel is
a=np.clip((gold-30)/(120-30),0,1)
a=ndi.gaussian_filter(a,0.3)
lab,n=ndi.label(a>0.25); sizes=ndi.sum(np.ones_like(a),lab,range(1,n+1))
keep=np.isin(lab, 1+np.nonzero(sizes>=6)[0]) # drop jpeg specks
a=a*ndi.binary_dilation(keep,iterations=2)
ys,xs=np.nonzero(a>0.02); x0,x1,y0,y1=xs.min()-2,xs.max()+3,ys.min()-2,ys.max()+3
rgb=np.clip(reg/np.maximum(1e-3,reg.max(axis=2,keepdims=True))*gc.max()*1.0,0,255) # normalise brightness to the gold
bg=np.array([19.,19.,27.])
# each pixel is (gold x a) + (background x (1-a)): take the background back out to get the true gold
un=(reg-(1-a[...,None])*bg)/np.maximum(a[...,None],0.08)
rgb=np.where(a[...,None]>0.02, np.clip(un,0,255), 0)
# where the image is too faint to say, use the logo's main gold
core=np.array([208.,173.,14.]);  # the logo's gold as displayed (the screenshot is Display P3)
rgb=np.broadcast_to(core,rgb.shape).copy()
L=np.dstack([rgb,a*255]).astype('uint8')[y0:y1,x0:x1]
S=3  # store at 3x with smooth upscaling so browsers draw it cleanly when shrinking
img=Image.fromarray(L,'RGBA').resize(((x1-x0)*S,(y1-y0)*S),Image.LANCZOS)
buf=io.BytesIO(); img.save(buf,'PNG',optimize=True); b64=base64.b64encode(buf.getvalue()).decode()
print('calligraphy layer', img.size, len(buf.getvalue())//1024,'KB')
def smooth_path(P):
    P=np.array(P); n=len(P); s=f"M{P[0][0]:.2f} {P[0][1]:.2f}"
    for i in range(n):
        p0,p1,p2,p3=P[(i-1)%n],P[i],P[(i+1)%n],P[(i+2)%n]; c1=p1+(p2-p0)/6; c2=p2-(p3-p1)/6
        s+=f"C{c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}"
    return s+"Z"
grey='#%02x%02x%02x'%tuple(int(v) for v in d['grey'])
allp=np.array([p for b in d['bars'] for p in b]+[[x0,y0],[x1,y1]])
bx0,by0=allp.min(0)-3; bx1,by1=allp.max(0)+3
bars="".join(f'<path d="M{" L".join(f"{x:.2f} {y:.2f}" for x,y in b)}Z"/>' for b in d['bars'])
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{bx0:.1f} {by0:.1f} {bx1-bx0:.1f} {by1-by0:.1f}">
<g fill="{grey}">{bars}</g>
<path fill="#13131c" d="{smooth_path(d['sil'])}"/>
<image x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" href="data:image/png;base64,{b64}"/>
</svg>'''
open('logo-hybrid.svg','w').write(svg); print('svg', len(svg)//1024,'KB')
