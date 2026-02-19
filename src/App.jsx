import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// CORRECCIÓN VERCEL: @dnd-kit (con D)
import { DndContext, closestCenter, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: CANCIÓN INDIVIDUAL (ORDENABLE) ---
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
    opacity: isDragging ? 0.7 : 1,
    marginBottom: '10px',
    borderRadius: '12px',
    backgroundColor: '#111',
    border: isDragging ? '2px solid #4da6ff' : '1px solid #333',
    touchAction: 'none'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div 
        style={estaAbierta ? estilos.headerActivo : estilos.headerNormal} 
        {...attributes} {...listeners}
        onClick={() => setCancionAbierta(estaAbierta ? null : c.id)}
      >
        <div style={{flex: 1}}>
          <div style={{fontSize: '0.9rem', color: '#fff', fontWeight: 'bold'}}>
            {c.categoria && <span style={estilos.tag}>{c.categoria}</span>} {c.titulo}
          </div>
          <div style={{fontSize: '0.75rem', color: '#4da6ff'}}>
            Tono: {transponer(c.tono || c.key, misSemitonos)} | 🎤 {c.cantante || c.vocal || 'Voz'}
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
              <span style={{color:'#fff', minWidth:'20px', textAlign:'center'}}>{misSemitonos}</span>
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

// --- APP PRINCIPAL ---
export default function App() {
  const [pantalla, setPantalla] = useState('inicio');
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [setlist, setSetlist] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);
  const [citaBiblica, setCitaBiblica] = useState('');
  const [textoBiblico, setTextoBiblico] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
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
    alert("✅ Plan guardado");
  };

  const buscarBiblia = async () => {
    if (!citaBiblica) return;
    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(citaBiblica)}?translation=rvr09`);
      const data = await res.json();
      setTextoBiblico(data.text || "Cita no encontrada");
    } catch (e) { alert("Error al buscar"); }
  };

  const enviarWhatsApp = () => {
    let msg = `*ITED MONTE ALEGRE*\n*PLAN: ${fecha.toLocaleDateString()}*\n*Dirige:* ${director || '---'}\n\n`;
    ["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"].forEach(cat => {
      const filtradas = setlist.filter(c => c.categoria === cat);
      if (filtradas.length > 0) {
        msg += `*[ ${cat.toUpperCase()} ]*\n`;
        filtradas.forEach(c => msg += `• ${c.titulo} (${c.tono || '?'}) - ${c.cantante || 'Voz'}\n`);
        msg += `\n`;
      }
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (pantalla === 'inicio') {
    return (
      <div style={estilos.fondoInicio}>
        <div style={estilos.homeContent}>
          <h2 style={{color:'#1e40af', fontWeight:'900', fontSize:'2.2rem', margin:0}}>ITED</h2>
          <div style={estilos.logoBox}>
            <img src="https://raw.githubusercontent.com/JC100HN/ODRE-NUEVO/main/src/assets/logo%20odre%20nuevo.png" alt="logo" style={{width:'100%'}} />
          </div>
          <h2 style={{color:'#1e40af', fontWeight:'900', fontSize:'1.8rem', margin:0}}>MONTE ALEGRE</h2>
          <div style={estilos.gridBotones}>
            <button style={estilos.btnHome} onClick={() => setPantalla('preparar')}>📝 Preparar</button>
            <button style={estilos.btnHome} onClick={() => setPantalla('ensayo')}>📖 Culto</button>
            <button style={estilos.btnHome} onClick={() => setPantalla('biblia')}>📜 Biblia</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={estilos.fondoApp}>
      <div style={estilos.container}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
          <button onClick={() => setPantalla('inicio')} style={estilos.btnAccion}>← Volver</button>
          <div style={{display:'flex', gap:'8px'}}>
             <button onClick={enviarWhatsApp} style={estilos.btnWA}>WhatsApp</button>
             <button onClick={async () => { if(window.confirm("¿Borrar plan?")) { await supabase.from('planes_culto').delete().eq('fecha', fecha.toISOString().split('T')[0]); setSetlist([]); setDirector(""); } }} style={estilos.btnBorrar}>🗑️ Borrar</button>
          </div>
        </div>

        {pantalla === 'biblia' && (
          <div style={{textAlign:'center'}}>
            <h2 style={{color:'#4da6ff'}}>La Biblia 📜</h2>
            <div style={{display:'flex', gap:'8px', marginBottom:'15px'}}>
                <input type="text" placeholder="Ej: Juan 3:16" value={citaBiblica} onChange={(e) => setCitaBiblica(e.target.value)} style={estilos.search} />
                <button onClick={buscarBiblia} style={estilos.btnMiniG}>🔍</button>
            </div>
            {textoBiblico && <div style={estilos.areaPlan}><p style={{lineHeight:'1.8'}}>{textoBiblico}</p></div>}
          </div>
        )}

        {pantalla === 'preparar' && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
            <div style={estilos.cajaBlanca}>
                <style>{`.react-calendar__tile { color: black !important; font-weight: bold; } .react-calendar { border: none; width: 100%; }`}</style>
                <Calendar onChange={setFecha} value={fecha} />
                <input type="text" placeholder="¿Quién dirige?" value={director} onChange={(e) => setDirector(e.target.value)} style={estilos.inputDirector} />
            </div>

            <div style={{width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h4 style={{color:'#4da6ff', margin:0}}>PLAN ACTUAL</h4>
              <button onClick={guardarPlan} style={estilos.btnMiniG}>💾 GUARDAR</button>
            </div>

            <div style={estilos.areaPlan}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
                const {active, over} = e;
                if (active.id !== over.id) {
                  setSetlist((items) => {
                    const oldIdx = items.findIndex(i => i.id === active.id);
                    const newIdx = items.findIndex(i => i.id === over.id);
                    return arrayMove(items, oldIdx, newIdx);
                  });
                }
              }}>
                <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  {setlist.map(c => (
                    <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta}
                      cambiarCategoria={(id, cat) => setSetlist(setlist.map(i => i.id === id ? {...i, categoria: cat} : i))}
                      quitarDelSetlist={(id) => setSetlist(setlist.filter(i => i.id !== id))}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            <input type="text" placeholder="🔍 Buscar canción..." style={estilos.search} onChange={(e) => setBusqueda(e.target.value)} />
            
            <div style={estilos.divisor}>🎸 ALABANZA</div>
            {canciones.filter(c => c.tipo_ritmo === 'Alabanza' && c.titulo.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 5).map(c => (
              <div key={c.id} style={estilos.itemRepo}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:'bold'}}>{c.titulo}</div>
                  <div style={{fontSize:'0.7rem', color:'#777'}}>{c.cantante || 'Voz'}</div>
                </div>
                <button onClick={() => setSetlist([...setlist, {...c, id: `s-${Date.now()}`}])} style={estilos.btnPlus}>+</button>
              </div>
            ))}

            <div style={estilos.divisor}>🙏 ADORACIÓN</div>
            {canciones.filter(c => c.tipo_ritmo === 'Adoración' && c.titulo.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 5).map(c => (
              <div key={c.id} style={estilos.itemRepo}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:'bold'}}>{c.titulo}</div>
                  <div style={{fontSize:'0.7rem', color:'#777'}}>{c.cantante || 'Voz'}</div>
                </div>
                <button onClick={() => setSetlist([...setlist, {...c, id: `s-${Date.now()}`}])} style={estilos.btnPlus}>+</button>
              </div>
            ))}
          </div>
        )}

        {pantalla === 'ensayo' && (
          <div>
            <h2 style={{textAlign:'center', color:'#4da6ff'}}>Director: {director || '---'}</h2>
            {setlist.map(c => <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta} modoLectura={true} />)}
          </div>
        )}
      </div>
    </div>
  );
}

const estilos = {
  fondoInicio: { background: 'linear-gradient(135deg, #f0f9ff 0%, #c0e8ff 100%)', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  homeContent: { textAlign:'center', width:'90%', maxWidth:'400px' },
  logoBox: { width:'140px', margin:'20px auto', background:'#fff', borderRadius:'40px', padding:'5px' },
  gridBotones: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px' },
  btnHome: { background:'#fff', border:'none', padding:'20px', borderRadius:'20px', fontWeight:'bold', color:'#1e40af' },
  fondoApp: { background:'#000', minHeight:'100vh', color:'#fff', padding:'20px 0' },
  container: { width:'95%', maxWidth:'450px', margin:'0 auto' },
  btnAccion: { background:'#222', color:'#fff', border:'none', padding:'10px 15px', borderRadius:'10px' },
  btnWA: { background:'#25D366', color:'#fff', border:'none', padding:'10px 15px', borderRadius:'10px', fontWeight:'bold' },
  btnBorrar: { background:'#ef4444', color:'#fff', border:'none', padding:'10px 15px', borderRadius:'10px' },
  cajaBlanca: { background: '#fff', padding: '15px', borderRadius: '20px', marginBottom: '20px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  inputDirector: { width: '100%', padding: '12px', marginTop: '10px', borderRadius: '10px', border: '2px solid #000', textAlign: 'center', fontWeight: 'bold', color: '#000', backgroundColor: '#fff' },
  btnMiniG: { background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold' },
  areaPlan: { background: '#0a0a0a', width: '100%', padding: '10px', borderRadius: '15px', border: '1px solid #222', marginBottom:'20px' },
  headerNormal: { display:'flex', padding:'15px', background:'#161616', borderRadius:'12px' },
  headerActivo: { display:'flex', padding:'15px', background:'#1e3a8a', borderRadius:'12px 12px 0 0' },
  tag: { background:'#4da6ff', color:'#000', padding:'2px 5px', borderRadius:'4px', fontSize:'0.6rem', fontWeight:'bold', marginRight:'5px' },
  miniSelect: { background:'#222', color:'#fff', border:'none', fontSize:'0.7rem', borderRadius:'5px' },
  btnX: { background:'none', border:'none', color:'#ef4444', fontSize:'1.2rem' },
  contenido: { padding:'15px', background:'#050505', borderRadius:'0 0 12px 12px', border:'1px solid #1e3a8a' },
  filaControles: { display:'flex', justifyContent:'space-between', marginBottom:'15px' },
  grupoControl: { display:'flex', gap:'10px', alignItems:'center', background:'#111', padding:'5px 10px', borderRadius:'10px' },
  btnT: { background:'#333', border:'none', color:'#fff', padding:'5px 10px', borderRadius:'5px' },
  letraPre: { whiteSpace:'pre-wrap', color:'#eee', fontFamily:'monospace', lineHeight:'1.6' },
  divisor: { margin:'20px 0 10px', color:'#4da6ff', fontWeight:'bold', textAlign:'center' },
  search: { width:'100%', padding:'15px', borderRadius:'15px', background:'#111', border:'1px solid #333', color:'#fff', marginBottom:'15px' },
  itemRepo: { display:'flex', padding:'15px', background:'#111', borderRadius:'15px', marginBottom:'10px', alignItems:'center' },
  btnPlus: { background:'#3b82f6', border:'none', color:'#fff', width:'35px', height:'35px', borderRadius:'50%', fontSize:'1.2rem' }
}