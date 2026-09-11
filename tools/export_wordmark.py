"""Export the v5 text-only wordmark as outlined Roboto Serif SVG / PNG.
Requires fonttools[woff], brotli and cairosvg; font licensed under OFL in licenses.
This is static branding artwork, not a browser screenshot.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
import cairosvg
r=Path(__file__).resolve().parents[1]
font=TTFont(r/'client/node_modules/@fontsource-variable/roboto-serif/files/roboto-serif-latin-wght-normal.woff2')
font=instantiateVariableFont(font,{'wght':750},inplace=True)
glyphs=font.getGlyphSet();cmap=font.getBestCmap();scale=90/font['head'].unitsPerEm

def outlines(text,size=90):
    scale=size/font['head'].unitsPerEm;x=0;paths=[]
    for char in text:
        name=cmap.get(ord(char),'space');pen=SVGPathPen(glyphs);glyphs[name].draw(pen)
        if pen.getCommands():paths.append(f'<path transform="translate({x:.3f} 0) scale({scale:.6f} {-scale:.6f})" d="{pen.getCommands()}"/>')
        x+=font['hmtx'][name][0]*scale-size*.04375
    return ''.join(paths),x+size*.04375
paths,w=outlines('Interview Prep AI');width=w+80
svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="{1320*160/width:.2f}" viewBox="0 0 {width:.2f} 160" role="img" aria-labelledby="title"><title id="title">Interview Prep AI — logo typographique</title><g fill="#211A14" transform="translate(40 110)">{paths}</g></svg>'
(r/'branding/interview-prep-logo.svg').write_text(svg)
cairosvg.svg2png(bytestring=svg.encode(),write_to=str(r/'branding/interview-prep-logo.png'))
p,wsmall=outlines('IP',45)
favicon=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>Interview Prep AI</title><g fill="#8B5000" transform="translate({(64-wsmall)/2:.3f} 48)">{p}</g></svg>'
for n in ['client/public/favicon.svg','branding/interview-prep-symbol.svg','branding/interview-prep-monogram.svg']:(r/n).write_text(favicon)
board=f'<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="480" viewBox="0 0 1120 480"><title>Interview Prep AI — identité typographique v5</title><rect width="1120" height="480" fill="#FFF8F5"/><g fill="#211A14" transform="translate({(1120-w)/2:.2f} 270)">{paths}</g></svg>'
(r/'branding/identite-v5.svg').write_text(board)
cairosvg.svg2png(bytestring=board.encode(),write_to=str(r/'branding/identite-v5.png'))
print('Text-only logo / favicon / identity artwork exported.')
