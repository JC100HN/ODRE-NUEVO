import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// LA CORRECCIÓN CLAVE: @dnd-kit (con D)
import { DndContext, closestCenter, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: ITEM DE CANCIÓN ---
function ItemSortable({ c, cancionAbierta, setCancionAbierta, quitarDelSetlist, cambiarCategoria, modoLectura }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const [misSemitonos, setMisSemitonos] = useState(0);
  const [tamanoLetra, setTamanoLetra] = useState(16);
  const estaAbierta = cancionAbierta === c.id;

  const transponer = (texto, cantidad) => {
    if (!texto || cantidad === 0) return texto;
    try { return Transposer.transpose(texto).up(cantidad).toString(); } 
    catch (e) { return texto; }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.6 : 1,
    marginBottom: '10px',
    borderRadius: '15px',
    backgroundColor: '#111',
    border: isDragging ? '2px solid #4da6ff' : '1px solid #222',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div 
        style={estaAbierta ? estilos.headerActivo : estilos.headerNormal} 
        {...attributes} {...listeners}
        onClick={() => setCancionAbierta(estaAbierta ? null : c.id)}
      >
        <div style={{flex: 1}}>
          <div style={{fontSize: '0.95rem', color: '#fff', fontWeight: 'bold'}}>
            {c.categoria && <span style={estilos.tag}>{c.categoria}</span>} {c.titulo}
          </div>
          <div style={{fontSize: '0.8rem', color: '#4da6ff', marginTop: '4px'}}>
            Tono: {transponer(c.tono || c.key, misSemitonos)} {c.cantante ? `| ${c.cantante}` : ''}
          </div>
        </div>
        {!modoLectura && (
          <div style={{display: 'flex', gap: '8px'}} onClick={(e) => e.stopPropagation()}>
            <select value={c.categoria || ""} onChange={(e) => cambiarCategoria(c.id, e.target.value)} style={estilos.miniSelect}>
              <option value="">Tipo...</option>
              {["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"].map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <button onClick={() => quitarDelSetlist(c.id)} style={estilos.btnX}>×</button>
          </div>
        )}
      </div>
      {estaAbierta && (
        <div style={estilos.contenido}>
          <div style={estilos.filaControles}>
            <div style={estilos.grupoControl}>
              <button onClick={(e) => { e.stopPropagation(); setMisSemitonos(s => s - 1); }} style={estilos.btnT}>-</button>
              <span style={{color:'#fff', fontWeight:'bold', minWidth:'25px', textAlign:'center'}}>{misSemitonos}</span>
              <button onClick={(e) => { e.stopPropagation(); setMisSemitonos(s => s + 1); }} style={estilos.btnT}>+</button>
            </div>
            <div style={estilos.grupoControl}>
              <button onClick={(e) => { e.stopPropagation(); setTamanoLetra(s => s - 2); }} style={estilos.btnT}>A-</button>
              <button onClick={(e) => { e.stopPropagation(); setTamanoLetra(s => s + 2); }} style={estilos.btnT}>A+</button>
            </div>
          </div>
          <pre style={{...estilos.letraPre, fontSize: `${tamanoLetra}px`}}>
            {transponer(c.letra || c.lyrics, misSemitonos)}
          </pre>
        </div>
      )}
    </div>
  );
}

// --- APP ---
export default function App() {
  const [pantalla, setPantalla] = useState('inicio');
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [setlist, setSetlist] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } })
  );

  useEffect(() => {
    const cargarDatos = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true });
      if (data) setCanciones(data);
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    const cargarPlan = async () => {
      const iso = fecha.toISOString().split('T')[0];
      const { data } = await supabase.from('planes_culto').select('*').eq('fecha', iso).maybeSingle();
      if (data) { setDirector(data.director || ""); setSetlist(data.canciones || []); }
      else { setDirector(""); setSetlist([]); }
    };
    cargarPlan();
  }, [fecha]);

  const guardarPlan = async () => {
    const iso = fecha.toISOString().split('T')[0];
    await supabase.from('planes_culto').upsert({ fecha: iso, director, canciones: setlist }, { onConflict: 'fecha' });
    alert("✅ Guardado en la Nube");
  };

  const enviarWhatsApp = () => {
    let msg = `*ITED MONTE ALEGRE*\n*PLAN: ${fecha.toLocaleDateString()}*\n*Dirige:* ${director || '---'}\n\n`;
    ["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"].forEach(cat => {
      const filtradas = setlist.filter(c => c.categoria === cat);
      if (filtradas.length > 0) {
        msg += `*[ ${cat.toUpperCase()} ]*\n`;
        filtradas.forEach(c => {
          msg += `• ${c.titulo} (${c.tono || '?'}) ${c.cantante ? ' - ' + c.cantante : ''}\n`;
        });
        msg += `\n`;
      }
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (pantalla === 'inicio') {
    return (
      <div style={estilos.fondoInicio}>
        <div style={estilos.homeContent}>
          <h2 style={{color:'#1e40af', fontWeight:'900', fontSize:'2.5rem', margin:0}}>ITED</h2>
          <div style={estilos.logoBox}>
            <img src="https://raw.githubusercontent.com/JC100HN/ODRE-NUEVO/main/src/assets/logo%20odre%20nuevo.png" alt="logo" style={{width:'100%', height:'100%', objectFit:'contain'}} />
          </div>
          <h2 style={{color:'#1e40af', fontWeight:'900', fontSize:'2rem', margin:0}}>MONTE ALEGRE</h2>
          <p style={{color:'#64748b', marginBottom:'40px', fontWeight:'500'}}>Ministerio de Alabanza</p>
          <div style={estilos.gridBotones}>
            <button style={estilos.btnHome} onClick={() => setPantalla('preparar')}>📝 Preparar</button>
            <button style={estilos.btnHome} onClick={() => setPantalla('ensayo')}>📖 Culto</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={estilos.fondoApp}>
      <div style={estilos.container}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
          <button onClick={() => setPantalla('inicio')} style={estilos.btnAccion}>← Inicio</button>
          {pantalla === 'preparar' && (
            <div style={{display:'flex', gap:'8px'}}>
              <button onClick={enviarWhatsApp} style={estilos.btnWA}>WhatsApp</button>
              <button onClick={async () => { if(window.confirm("¿Borrar todo?")) { await supabase.from('planes_culto').delete().eq('fecha', fecha.toISOString().split('T')[0]); setSetlist([]); setDirector(""); } }} style={estilos.btnBorrar}>Borrar</button>
            </div>
          )}
        </div>

        {pantalla === 'preparar' && (
          <div style={{display:'flex', flexDirection:'column', width:'100%'}}>
            <div style={estilos.cajaCalendario}>
              <style>{`
                .react-calendar { border: none !important; width: 100% !important; font-family: sans-serif; }
                .react-calendar__tile { color: #000 !important; font-weight: bold !important; padding: 12px 5px !important; }
                .react-calendar__month-view__weekdays__weekday abbr { text-decoration: none; color: #666; }
                .react-calendar__navigation button { font-weight: bold; color: #1e40af; }
              `}</style>
              <Calendar onChange={setFecha} value={fecha} />
              <input type="text" placeholder="¿Quién dirige el culto?" value={director} onChange={(e) => setDirector(e.target.value)} style={estilos.inputDir} />
            </div>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', margin:'10px 0'}}>
              <h4 style={{color:'#4da6ff', margin:0}}>PLANIFICACIÓN</h4>
              <button onClick={guardarPlan} style={estilos.btnG}>💾 GUARDAR</button>
            </div>

            <div style={estilos.areaLista}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
                const {active, over} = e;
                if (active && over && active.id !== over.id) {
                  setSetlist((items) => {
                    const oldIndex = items.findIndex(i => i.id === active.id);
                    const newIndex = items.findIndex(i => i.id === over.id);
                    return arrayMove(items, oldIndex, newIndex);
                  });
                }
              }}>
                <SortableContext items={setlist.map((i, idx) => i.id || idx)} strategy={verticalListSortingStrategy}>
                  {setlist.map(c => (
                    <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta}
                      cambiarCategoria={(id, cat) => setSetlist(setlist.map(i => i.id === id ? {...i, categoria: cat} : i))}
                      quitarDelSetlist={(id) => setSetlist(setlist.filter(i => i.id !== id))}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            <div style={estilos.divisor}>BIBLIOTECA</div>
            <input type="text" placeholder="🔍 Buscar canción..." style={estilos.search} onChange={(e) => setBusqueda(e.target.value)} />
            {canciones.filter(c => (c.titulo||'').toLowerCase().includes(busqueda.toLowerCase())).slice(0, 10).map(c => (
              <div key={c.id} style={estilos.itemRepo}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:'bold', fontSize:'0.9rem'}}>{c.titulo}</div>
                  <div style={{fontSize:'0.75rem', color:'#888'}}>{c.cantante || ''}</div>
                </div>
                <button onClick={() => setSetlist([...setlist, {...c, id: `set-${Date.now()}-${Math.random()}`}])} style={estilos.btnPlus}>+</button>
              </div>
            ))}
          </div>
        )}

        {pantalla === 'ensayo' && (
          <div>
            <h2 style={{textAlign:'center', color:'#4da6ff', marginBottom:'25px'}}>{director || 'CULTO'}</h2>
            {setlist.map(c => <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta} modoLectura={true} />)}
          </div>
        )}
      </div>
    </div>
  );
}

const estilos = {
  fondoInicio: { background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', width: '100%', top:0, left:0 },
  homeContent: { textAlign:'center', width:'90%', maxWidth:'400px' },
  logoBox: { width:'160px', height:'160px', margin:'20px auto', background:'#fff', borderRadius:'45px', padding:'10px', boxShadow:'0 15px 30px rgba(0,0,0,0.1)', border:'4px solid #fff' },
  gridBotones: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px' },
  btnHome: { background:'#fff', border:'none', padding:'30px 10px', borderRadius:'25px', fontWeight:'900', color:'#1e40af', fontSize:'1.1rem', boxShadow:'0 8px 15px rgba(0,0,0,0.05)' },
  fondoApp: { background:'#000', minHeight:'100vh', color:'#fff', padding:'20px 0' },
  container: { width:'92%', maxWidth:'450px', margin:'0 auto', display:'flex', flexDirection:'column', alignItems:'center' },
  btnAccion: { background:'#111', color:'#fff', border:'1px solid #333', padding:'10px 18px', borderRadius:'12px', fontWeight:'bold' },
  btnWA: { background:'#25D366', color:'#fff', border:'none', padding:'10px 15px', borderRadius:'12px', fontWeight:'bold', fontSize:'0.85rem' },
  btnBorrar: { background:'#ef4444', color:'#fff', border:'none', padding:'10px 15px', borderRadius:'12px', fontWeight:'bold', fontSize:'0.85rem' },
  cajaCalendario: { background:'#fff', padding:'20px', borderRadius:'25px', width:'100%', boxSizing:'border-box', marginBottom:'20px' },
  inputDir: { width:'100%', padding:'15px', marginTop:'15px', borderRadius:'15px', border:'2px solid #f1f5f9', background:'#f8fafc', textAlign:'center', fontWeight:'bold', fontSize:'1rem', color:'#1e293b' },
  btnG: { background:'#3b82f6', color:'#fff', border:'none', padding:'12px 20px', borderRadius:'15px', fontWeight:'bold' },
  areaLista: { background:'#080808', width:'100%', padding:'12px', borderRadius:'20px', border:'1px solid #111', boxSizing:'border-box' },
  headerNormal: { display:'flex', padding:'18px', background:'#161616', borderRadius:'15px' },
  headerActivo: { display:'flex', padding:'18px', background:'#1e3a8a', borderRadius:'15px 15px 0 0' },
  tag: { background:'#4da6ff', color:'#000', padding:'3px 7px', borderRadius:'6px', fontSize:'0.65rem', fontWeight:'bold', marginRight:'8px' },
  miniSelect: { background:'#222', color:'#fff', border:'1px solid #444', fontSize:'0.75rem', borderRadius:'8px', padding:'6px' },
  btnX: { background:'none', border:'none', color:'#ff4d4d', fontSize:'1.6rem', lineHeight:0 },
  contenido: { padding:'20px', background:'#050505', borderRadius:'0 0 15px 15px', border:'1px solid #1e3a8a', borderTop:'none' },
  filaControles: { display:'flex', justifyContent:'space-between', marginBottom:'20px' },
  grupoControl: { display:'flex', gap:'12px', alignItems:'center', background:'#111', padding:'8px 12px', borderRadius:'12px', border:'1px solid #222' },
  btnT: { background:'#222', border:'1px solid #444', color:'#fff', padding:'8px 15px', borderRadius:'8px', fontWeight:'bold' },
  letraPre: { whiteSpace:'pre-wrap', color:'#eee', fontFamily:'monospace', lineHeight:'1.8' },
  divisor: { margin:'30px 0 15px', color:'#4da6ff', fontWeight:'900', textAlign:'center', letterSpacing:'1px' },
  search: { width:'100%', padding:'18px', borderRadius:'18px', background:'#111', border:'1px solid #222', color:'#fff', marginBottom:'20px', boxSizing:'border-box' },
  itemRepo: { display:'flex', padding:'18px', background:'#111', borderRadius:'18px', marginBottom:'12px', alignItems:'center', border:'1px solid #1a1a1a' },
  btnPlus: { background:'#3b82f6', border:'none', color:'#fff', width:'40px', height:'40px', borderRadius:'14px', fontSize:'1.5rem', display:'flex', alignItems:'center', justifyContent:'center' }
}