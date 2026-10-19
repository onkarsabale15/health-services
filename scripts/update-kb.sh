#!/bin/bash
# Universal Knowledge Base Update Script for Health Services
# Works for both Gemini CLI and Claude Code

echo "🔄 Updating Knowledge Base with Forced Groupings..."

# 1. Environment
PYTHON=$(cat graphify-out/.graphify_python 2>/dev/null || echo "python3")

# 2. Sync Manifest
$PYTHON -c "from graphify.detect import detect, save_manifest; from pathlib import Path; save_manifest(detect(Path('.')).get('files', {}))"

# 3. Strictly Grouped Export Logic
cat << 'PY_EOF' > graphify-out/.update_kb.py
import sys, json, os
from networkx.readwrite import json_graph
import networkx as nx
from pathlib import Path
from collections import defaultdict
from graphify.export import to_json, to_html, to_obsidian, to_canvas

# Load Graph
graph_path = Path('graphify-out/graph.json')
if graph_path.exists():
    data = json.loads(graph_path.read_text())
    # Force directed graph for dependency analysis
    G = json_graph.node_link_graph(data, edges='links')
    if not nx.is_directed(G):
        # Convert to DiGraph while preserving edge attributes
        DG = nx.DiGraph()
        DG.add_nodes_from(G.nodes(data=True))
        for u, v, d in G.edges(data=True):
            # In node-link format, _src and _tgt preserve original extraction direction
            src_id = d.get('_src', u)
            tgt_id = d.get('_tgt', v)
            if src_id in G and tgt_id in G:
                DG.add_edge(src_id, tgt_id, **d)
        G = DG
else:
    G = nx.DiGraph()

# --- ENHANCEMENT 1: Workspace Dependency Mapping ---
print('📦 Mapping Workspace Dependencies...')
package_map = {} # name -> path
for root, dirs, files in os.walk('.'):
    if 'node_modules' in dirs: dirs.remove('node_modules')
    if 'package.json' in files:
        pkg_path = Path(root) / 'package.json'
        try:
            pkg_data = json.loads(pkg_path.read_text())
            pkg_name = pkg_data.get('name')
            if pkg_name:
                package_map[pkg_name] = root.lstrip('./')
        except: pass

# Inject Package Nodes and DependsOn Edges
for pkg_name, pkg_path in package_map.items():
    pkg_id = f'pkg_{pkg_name.replace("@", "").replace("/", "_")}'
    if not G.has_node(pkg_id):
        G.add_node(pkg_id, label=f'Package: {pkg_name}', file_type='config', source_file=f'{pkg_path}/package.json', community=1002)
    
    # Read package.json again for deps
    try:
        pkg_data = json.loads((Path(pkg_path) / 'package.json').read_text())
        all_deps = {**pkg_data.get('dependencies', {}), **pkg_data.get('devDependencies', {})}
        for dep_name in all_deps:
            if dep_name in package_map:
                dep_pkg_id = f'pkg_{dep_name.replace("@", "").replace("/", "_")}'
                if not G.has_edge(pkg_id, dep_pkg_id):
                    G.add_edge(pkg_id, dep_pkg_id, relation='depends_on', confidence='EXTRACTED', confidence_score=1.0)
    except: pass

# --- ENHANCEMENT 2: Automated Architectural Guardrails ---
print('🛡 Checking Architectural Guardrails...')
violations = []
forbidden_patterns = [
    ('packages/ehr-data-service/', 'packages/ai/', 'Dumb service should not depend on AI'),
    ('packages/observability/', 'packages/infra/', 'Observability must not depend on Infra (init order)'),
    ('packages/ehr-data-service/', 'apps/', 'Core services must not depend on Applications'),
]

for u, v, d in G.edges(data=True):
    u_src = G.nodes[u].get('source_file', '')
    v_src = G.nodes[v].get('source_file', '')
    
    for u_pat, v_pat, reason in forbidden_patterns:
        if u_pat in u_src and v_pat in v_src:
            # Check direction: if u (source) is forbidden from depending on v (target)
            # The 'imports_from' relation in graphify is: SOURCE imports from TARGET.
            # So if G.has_edge(u, v) with 'imports_from', then u depends on v.
            if d.get('relation') == 'imports_from':
                 violations.append(f'❌ **Violation**: `{u_src}` -> `{v_src}` ({reason})')

# --- ENHANCEMENT 3: Messaging Traceability ---
print('📡 Linking Producers and Consumers...')
topics = defaultdict(lambda: {"producers": [], "consumers": []})
for nid, ndata in G.nodes(data=True):
    label = ndata.get('label', '').lower()
    if 'audit' in label: topics['audit-logs']['producers' if 'interceptor' in label else 'consumers'].append(nid)
    if 'patient' in label and 'sync' in label: topics['patient-events']['producers' if 'athena' in label else 'consumers'].append(nid)

for topic, actors in topics.items():
    for p in actors['producers']:
        for c in actors['consumers']:
            if not G.has_edge(p, c):
                G.add_edge(p, c, relation=f'pubsub:{topic}', confidence='INFERRED', confidence_score=0.8)

# --- ENHANCEMENT 4: Anchor Node Persistence Checks ---
print('⚓ Verifying Anchor Nodes...')
anchors = {
    'Admin API': ['admin-api', 'AdminApi'],
    'Bridge API': ['bridge-api', 'BridgeApi'],
    'Workflow Engine': ['workflow-app', 'WorkflowApp', 'workflow-executor'],
    'CDS App': ['cds-app', 'CdsApp'],
    'Terminology Sync': ['terminology-sync', 'TerminologySync'],
    'Admin UI': ['admin-ui', 'AdminUi'],
    'CDS UI': ['cds-ui', 'CdsUi'],
    'Workflow UI': ['workflow-ui', 'WorkflowUi']
}
anchor_alerts = []
found_anchors = {name: False for name in anchors}
for nid, ndata in G.nodes(data=True):
    l = ndata.get('label', '')
    src = ndata.get('source_file', '')
    for name, patterns in anchors.items():
        if any(p.lower() in l.lower() or p.lower() in src.lower() for p in patterns):
            found_anchors[name] = True
            if (l.endswith('App') or l.endswith('Module') or l.endswith('Package')) and G.degree(nid) == 0:
                anchor_alerts.append(f'⚠️ **Isolated Anchor**: `{name}` ({l}) has no connections!')

for name, found in found_anchors.items():
    if not found:
        anchor_alerts.append(f'🚨 **Missing Anchor**: `{name}` not found in graph!')

# --- ENHANCEMENT 5: Interactive Conflict Resolution (Metadata) ---
ambiguous_edges = [f'`{G.nodes[u].get("label", u)}` --?--> `{G.nodes[v].get("label", v)}`' 
                   for u, v, d in G.edges(data=True) if d.get('confidence') == 'AMBIGUOUS']

# --- Grouping Logic ---
community_labels = {999: 'User Applications', 1000: 'EHR Implementations', 1001: 'Data Service Core', 1002: 'Shared Packages'}
communities = defaultdict(list)
apps_list = ['admin-api', 'bridge-api', 'workflow-app', 'cds-app', 'terminology-sync', 'admin-ui', 'cds-ui', 'workflow-ui']

for nid, ndata in G.nodes(data=True):
    src = ndata.get('source_file', '')
    label = ndata.get('label', '')
    
    cid = 1002
    if 'apps/' in src or any(a in label.lower() for a in apps_list): cid = 999
    elif 'packages/ehr-data-service/src/vendors/' in src: cid = 1000
    elif 'packages/ehr-data-service/src/core/' in src: cid = 1001
    elif nid.startswith('pkg_'): cid = 1002
    
    ndata['community'] = cid
    communities[cid].append(nid)
    if any(a in label.lower() for a in apps_list) or nid.startswith('pkg_'):
        ndata['size'] = 150 if not nid.startswith('pkg_') else 100
        ndata['font'] = {'size': 60 if not nid.startswith('pkg_') else 40, 'color': '#ffffff', 'background': '#000000', 'strokeWidth': 4, 'align': 'center'}

# --- Final Report Assembly ---
print(f'📝 Finalizing Report... Violations: {len(violations)}, Alerts: {len(anchor_alerts)}, Ambiguous: {len(ambiguous_edges)}')
report_path = Path('graphify-out/GRAPH_REPORT.md')
report_text = report_path.read_text() if report_path.exists() else '# Graph Report'

audit_section = '## 🔍 Architectural Audit\n'
if violations: audit_section += '\n### Policy Violations\n' + '\n'.join(list(set(violations)))
if anchor_alerts: audit_section += '\n### Anchor Node Status\n' + '\n'.join(list(set(anchor_alerts)))
if ambiguous_edges: audit_section += f'\n### Ambiguity Audit ({len(ambiguous_edges)})\n' + 'Pending review: ' + ', '.join(ambiguous_edges[:5]) + '...'

# Replace or append the audit section
if '## 🔍 Architectural Audit' in report_text:
    # Use a simpler non-regex replacement to avoid corruption
    parts = report_text.split('## 🔍 Architectural Audit')
    # Keep everything before the audit section
    before = parts[0]
    # Find the next section after audit
    after_parts = parts[1].split('\n## ')
    after = '\n## ' + '\n## '.join(after_parts[1:]) if len(after_parts) > 1 else ''
    report_text = before + audit_section + '\n' + after
elif '## Suggested Questions' in report_text:
    report_text = report_text.replace('## Suggested Questions', audit_section + '\n\n## Suggested Questions')
else:
    report_text += '\n\n' + audit_section

report_path.write_text(report_text)

# Final Export
obsidian_dir = 'graphify-out/obsidian'
to_json(G, communities, 'graphify-out/graph.json')
to_obsidian(G, communities, obsidian_dir, community_labels=community_labels)
to_canvas(G, communities, f'{obsidian_dir}/graph.canvas', community_labels=community_labels)
to_html(G, communities, f'{obsidian_dir}/interactive-graph.html', community_labels=community_labels)

# Force Obsidian Graph Colors
obsidian_config = Path(obsidian_dir) / '.obsidian' / 'graph.json'
obsidian_config.parent.mkdir(parents=True, exist_ok=True)
graph_settings = {
  'colorGroups': [
    { 'query': 'tag:#community/User_Applications', 'color': { 'a': 1, 'rgb': 5175399 } },
    { 'query': 'tag:#community/EHR_Implementations', 'color': { 'a': 1, 'rgb': 5222400 } },
    { 'query': 'tag:#community/Data_Service_Core', 'color': { 'a': 1, 'rgb': 15896107 } },
    { 'query': 'tag:#community/Shared_Packages', 'color': { 'a': 1, 'rgb': 10066329 } }
  ],
  'nodeSize': 1.5, 'repelStrength': 15, 'arrows': True, 'showArrow': True
}
obsidian_config.write_text(json.dumps(graph_settings, indent=2))

# Cleanup Redundant Notes
for root, dirs, files in os.walk(obsidian_dir):
    for f in files:
        if f.startswith('.') or f == 'constructor().md' or f in ['moment.md', 'rxjs.md']:
            os.remove(os.path.join(root, f))
PY_EOF

$PYTHON graphify-out/.update_kb.py

echo "✅ KB Updated. Re-open Obsidian Graph View to see colors."
