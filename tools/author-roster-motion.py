"""Regenerate five hero weapon families and the single-sword scout in memory.

Kaede and unrelated records remain unchanged. Use --output to preview the result.
"""
import argparse,copy,importlib.util,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def module(name):
 spec=importlib.util.spec_from_file_location(name.replace('-','_'),ROOT/'tools'/f'{name}.py')
 result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result

def author(data):
 """Mutate and return a motion mapping only after every family passes its audit."""
 source=copy.deepcopy(data);heavy=module('author-heavy-motion');twin=module('author-twin-motion');agile=module('author-agile-motion')
 records={}
 for profile in heavy.PROFILES.values():
  for index,name in enumerate(heavy.NAMES):records[profile['prefix']+name]=heavy.regular(profile,name,index,source[name]['duration'])
  records[profile['prefix']+'Musou_Flow']=heavy.musou(profile)
  records[profile['prefix']+'Ready']=heavy.ready(profile)
 heavy.check(records)
 twins=twin.generate(source);twin.validate(twins,source)
 agility=agile.generate(source);agile.audit(agility,source)
 assert not(set(records)&set(twins) or set(records)&set(agility) or set(twins)&set(agility)),'Overlapping authoring families'
 records.update(twins);records.update(agility)
 scout=module('author-scout-motion');scouts=scout.author({**source,**records});scout.validate(scouts,{**source,**records});records.update(scouts)
 assert not any(name.startswith('Fan_') for name in records),'Roster author must preserve Kaede'
 data.update(records);return data

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--source',type=pathlib.Path,default=ROOT/'src/motion-data.json',help='Input motion mapping')
 parser.add_argument('--output',type=pathlib.Path,default=ROOT/'src/motion-data.json',help='Output motion mapping; defaults to the shipping JSON')
 args=parser.parse_args();data=json.loads(args.source.read_text());author(data)
 args.output.write_text(json.dumps(data,separators=(',',':'))+'\n');print(f'Authored five weapon families; preserved Kaede and unrelated records: {args.output}')
