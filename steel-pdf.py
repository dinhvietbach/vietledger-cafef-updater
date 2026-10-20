"""Extract only explicitly headed monthly VSA tables in KIS sector reports.
Usage: python steel-pdf.py report.pdf. JSON is written to stdout; no network.
"""
import sys, re, json
from pypdf import PdfReader

def extract(filename):
    result=[]; notes=[]
    for page_no,page in enumerate(PdfReader(filename).pages,1):
        text=page.extract_text(extraction_mode='layout') or ''
        if 'Nguồn: VSA, KIS' not in text: continue
        # Never infer a reporting month from the date of publication.
        sections=re.split(r'Bảng\s+\d+\.\s*',text)[1:]
        for block in sections:
            if not re.match(r'Tăng trưởng sản lượng',block): continue
            header=re.search(r'^\s*(\d{1,2})/{1,2}(\d{2})\s+(\d{1,2})/{1,2}(\d{2})\s+T/T',block,re.M)
            if not header: continue
            m1,y1,m2,y2=map(int,header.groups())
            if m1!=m2 or y2-y1!=1 or not 1<=m1<=12:
                notes.append(f'Trang {page_no}: kỳ so sánh trong tiêu đề không nhất quán, chưa nhập.');continue
            periods=[f'20{y1:02}-{m1:02}',f'20{y2:02}-{m2:02}']
            metric='sales' if 'bán hàng' in block[:100] else 'production'
            product=None
            for line in block[header.end():].splitlines():
                line=line.strip()
                if line.startswith('Nguồn:'):break
                matched=False
                for label,p in [('Thép ống','pipe'),('Thép tôn','coated'),('Thép xây','construction')]:
                    if line.startswith(label): product=p;matched=True;break
                if line.startswith(('Thép cuộn','Tổng')): product=None
                if not product:continue
                kind=metric if matched and metric=='sales' else 'production' if line.startswith('Sản xuất') else 'inventory' if line.startswith('Tồn kho') and metric=='production' else 'vsa_exports' if line.startswith('Xuất khẩu') and metric=='sales' else 'sales_domestic' if line.startswith('Nội địa') and metric=='sales' else None
                if not kind:continue
                # Values appear before the percentage columns. Ignore accumulated columns.
                first=re.match(r'^(?:Thép (?:ống|tôn|xây(?: dựng)?)|Sản xuất|Xuất khẩu|Nội địa|Tồn kho)\s+(\d[\d.,]*)\s+(\d[\d.,]*)(?:\s|$)',line)
                if not first: continue
                numbers=first.groups()
                # KIS mixes dot and comma thousands separators in the same table.
                # Never scan into percentage/YTD columns when a monthly cell is absent.
                if not all(re.fullmatch(r'\d+|\d{1,3}(?:[.,]\d{3})+',x) for x in numbers): continue
                vals=[int(x.replace(',','').replace('.','')) for x in numbers]
                if any(v>20_000_000 for v in vals):continue
                for period,value in zip(periods,vals):
                    result.append({'product':product,'metric':kind,'period':period,'value':value,'page':page_no,'evidence':' '.join(line.split())})
    return {'rows':result,'notes':notes}

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(extract(sys.argv[1]),ensure_ascii=False))
