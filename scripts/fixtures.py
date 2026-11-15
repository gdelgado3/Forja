from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
base=Path(__file__).resolve().parents[1]/'dist'/'samples'
base.mkdir(exist_ok=True)
# Explicit synthetic geometry, never a drawing for manufacture.
pairs=[(0,'SECTION'),(2,'HEADER'),(9,'$ACADVER'),(1,'AC1027'),(9,'$INSUNITS'),(70,4),(0,'ENDSEC'),(0,'SECTION'),(2,'ENTITIES'),(0,'LWPOLYLINE'),(5,'A1'),(100,'AcDbEntity'),(8,'PORTAO_CONTORNO'),(100,'AcDbPolyline'),(90,4),(70,1)]
for x,y in [(0,0),(3000,0),(3000,1800),(0,1800)]:pairs.extend([(10,x),(20,y)])
pairs.extend([(0,'LINE'),(5,'A2'),(8,'TRAVESSAS'),(10,1500),(20,0),(30,0),(11,1500),(21,1800),(31,0),(0,'CIRCLE'),(5,'A3'),(8,'FURO_EXEMPLO'),(10,200),(20,200),(30,0),(40,25),(0,'TEXT'),(5,'A4'),(8,'NOTAS'),(10,0),(20,2000),(40,75),(1,'MATERIAL: ACO - EXEMPLO FICTICIO'),(0,'ENDSEC'),(0,'EOF')])
(base/'portao-demo.dxf').write_text('\n'.join(str(x) for p in pairs for x in p)+'\n')
(base/'portao-demo.ifc').write_text("""ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('portao-demo.ifc','2026-11-01T00:00:00',('Forja'),('Demonstração'),'Forja','Forja','Ficheiro sintético sem geometria de fabrico');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#2=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
#3=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
#4=IFCSIUNIT(*,.MASSUNIT.,.KILO.,.GRAM.);
#5=IFCUNITASSIGNMENT((#1,#2,#3,#4));
#10=IFCPROJECT('0J0w0ri1v5eO0CKcB1f0K1',$,'Projeto ficticio Forja',$,$,$,$,$,#5);
#30=IFCDOOR('0J0w0ri1v5eO0CKcB1f0K2',$,'Portao P01',$,$,$,$,'P01',1.8,3.,.GATE.,.SLIDING_TO_LEFT.,$);
#31=IFCRAILING('0J0w0ri1v5eO0CKcB1f0K3',$,'Guarda G01',$,$,$,$,'G01',.GUARDRAIL.);
#40=IFCMATERIAL('Aco S235',$,'Metal');
#41=IFCRELASSOCIATESMATERIAL('0J0w0ri1v5eO0CKcB1f0K4',$,$,$,(#30,#31),#40);
#50=IFCQUANTITYLENGTH('Width',$,$,3.,$);
#51=IFCQUANTITYLENGTH('Height',$,$,1.8,$);
#52=IFCQUANTITYAREA('GrossArea',$,$,5.4,$);
#53=IFCQUANTITYWEIGHT('NetWeight',$,$,85.,$);
#54=IFCELEMENTQUANTITY('0J0w0ri1v5eO0CKcB1f0K5',$,'BaseQuantities',$,$,(#50,#51,#52,#53));
#55=IFCRELDEFINESBYPROPERTIES('0J0w0ri1v5eO0CKcB1f0K6',$,$,$,(#30),#54);
#60=IFCQUANTITYLENGTH('Length',$,$,2.5,$);
#61=IFCELEMENTQUANTITY('0J0w0ri1v5eO0CKcB1f0K7',$,'BaseQuantities',$,$,(#60));
#62=IFCRELDEFINESBYPROPERTIES('0J0w0ri1v5eO0CKcB1f0K8',$,$,$,(#31),#61);
ENDSEC;
END-ISO-10303-21;
""")
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=ImageFont.truetype(fontpath,32);small=ImageFont.truetype(fontpath,25)
im=Image.new('RGB',(1400,1000),'white');d=ImageDraw.Draw(im)
d.text((80,35),'FORJA / EXEMPLO FICTICIO',font=f,fill='#214d3b')
d.rectangle((220,300,1100,740),outline='#294335',width=5)
for x in [440,660,880]:d.line((x,300,x,740),fill='#294335',width=3)
d.line((220,240,1100,240),fill='black',width=2)
for x in [220,1100]:d.line((x,225,x,255),fill='black',width=2)
d.text((520,185),'3000 mm',font=f,fill='black')
d.line((1160,300,1160,740),fill='black',width=2)
d.text((80,100),'LARGURA: 3000 mm',font=f,fill='black')
d.text((80,145),'ALTURA: 1800 mm',font=f,fill='black')
d.text((80,815),'MATERIAL: ACO S235',font=f,fill='black')
d.text((80,870),'ESPESSURA: 2 mm',font=f,fill='black')
d.text((80,935),'SEM ESCALA - NAO USAR PARA FABRICO',font=small,fill='#777777')
im.save(base/'portao-demo.png')
c=canvas.Canvas(str(base/'portao-demo.pdf'),pagesize=A4);c.setFont('Helvetica-Bold',18);c.drawString(50,780,'FORJA / EXEMPLO FICTICIO');c.setFont('Helvetica',13)
for y,t in [(735,'LARGURA: 3000 mm'),(710,'ALTURA: 1800 mm'),(685,'MATERIAL: ACO S235'),(660,'ESPESSURA: 2 mm')]:c.drawString(50,y,t)
c.rect(80,300,420,252);c.line(290,300,290,552);c.setFont('Helvetica',10);c.drawString(50,240,'SEM ESCALA - NAO USAR PARA FABRICO');c.save()
print('Created four explicit test fixtures.')
