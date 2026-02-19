import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// CORRECCIÓN AQUÍ: Asegurado que diga @dnd-kit con "d"
import { DndContext, closestCenter, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: ITEM DE CANCIÓN ---
function ItemSortable({ c, cancionAbierta, setCancionAbierta, quitarDelSetlist, cambiarCategoria, modoLectura }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const [misSemitonos, setMisSemitonos] = useState(0);
  const [tamanoLetra, setTamanoLetra] = useState(16);
  const estaAbierta = cancionAbierta === c.id;

  const transponerIndividual = (texto, cantidad) => {
    if (!texto || cantidad === 0) return texto;
    try { return Transposer.transpose(texto).up(cantidad).toString(); } 
    catch (e) { return texto; }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.6 : 1,
    scale: isDragging ? '1.02' : '1',
    marginBottom: '8px',
    borderRadius: '12px',
    border: isDragging ? '2px solid #4da6ff' : '1px solid #333',
    backgroundColor: '#111',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div 
        style={estaAbierta ? estilos.headerActivo : estilos.headerNormal} 
        {...attributes} 
        {...listeners}
        onClick={(e) => { if (!isDragging) setCancionAbierta(estaAbierta ? null : c.id); }}
      >
        <div style={{display:'flex', alignItems:'center', flex:1}}>
          {!modoLectura && <span style={{marginRight:'10px', color:'#555'}}>☰</span>}
          <div style={{flex: 1}}>
                <div style={{fontSize: '0.9rem', color: '#fff', fontWeight: 'bold'}}>
                    {c.categoria && <span style={estilos.tag}>{c.categoria}</span>} {c.titulo} 
                </div>
                <div style={{fontSize: '0.75rem', color: '#4da6ff'}}>
                    Tono: {transponerIndividual(c.tono || c.key, misSemitonos)} {c.cantante ? `| ${c.cantante}` : ''}
                </div>
          </div>
        </div>
        {!modoLectura && (
            <div style={{display: 'flex', gap: '5px', alignItems: 'center'}} onClick={(e) => e.stopPropagation()}>
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
          <div style={estilos.filaControles} onClick={(e) => e.stopPropagation()}>
                <div style={estilos.grupoControl}>
                    <button onClick={() => setMisSemitonos(s => s - 1)} style={estilos.btnT}>-</button>
                    <span style={{color: '#fff', fontSize:'0.9rem', minWidth:'25px', textAlign:'center'}}>{misSemitonos}</span>
                    <button onClick={() => setMisSemitonos(s => s + 1)} style={estilos.btnT}>+</button>
                </div>
                <div style={estilos.grupoControl}>
                    <button onClick={() => setTamanoLetra(s => s - 2)} style={estilos.btnT}>A-</button>
                    <button onClick={() => setTamanoLetra(s => s + 2)} style={estilos.btnT}>A+</button>
                </div>
          </div>
          <pre style={{...estilos.letraPre, fontSize: `${tamanoLetra}px`}}>
            {transponerIndividual(c.letra || c.lyrics, misSemitonos)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [pantalla, setPantalla] = useState('inicio');
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);
  const [setlist, setSetlist] = useState([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 1000, tolerance: 10 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setSetlist((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    const cargarBiblioteca = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true });
      if (data) setCanciones(data);
    };
    cargarBiblioteca();
  }, []);

  useEffect(() => {
    const cargarPlan = async () => {
      const fechaISO = fecha.toISOString().split('T')[0];
      const { data } = await supabase.from('planes_culto').select('*').eq('fecha', fechaISO).maybeSingle();
      if (data) {
        setDirector(data.director || "");
        setSetlist(data.canciones || []);
      } else {
        setDirector(""); setSetlist([]);
      }
    };
    cargarPlan();
  }, [fecha]);

  const guardarPlan = async () => {
    const fechaISO = fecha.toISOString().split('T')[0];
    await supabase.from('planes_culto').upsert({ fecha: fechaISO, director, canciones: setlist }, { onConflict: 'fecha' });
    alert("✅ Plan Guardado");
  };

  const enviarWhatsApp = () => {
    let mensaje = `*ITED MONTE ALEGRE*\n*PLAN: ${fecha.toLocaleDateString()}*\n*Dirige:* ${director || '---'}\n\n`;
    const categorias = ["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"];
    categorias.forEach(cat => {
        const filtradas = setlist.filter(c => c.categoria === cat);
        if (filtradas.length > 0) {
            mensaje += `*--- ${cat.toUpperCase()} ---*\n`;
            filtradas.forEach(c => {
                mensaje += `• ${c.titulo} (${c.tono || c.key}) ${c.cantante ? '- ' + c.cantante : ''}\n`;
            });
            mensaje += `\n`;
        }
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  if (pantalla === 'inicio') {
    return (
      <div style={estilos.fondoInicioClaro}>
        <div style={estilos.contenedorCentrado}>
          <h2 style={{color:'#1e40af', fontWeight:'900', margin:0, fontSize:'2.2rem'}}>ITED</h2>
          <div style={estilos.marcoLogo}>
             <img src="https://raw.githubusercontent.com/JC100HN/ODRE-NUEVO/main/src/assets/logo%20odre%20nuevo.png" alt="Logo" style={estilos.imagenLogo} />
          </div>
          <h2 style={{color:'#1e40af', fontWeight:'900', margin:0, fontSize:'1.8rem'}}>MONTE ALEGRE</h2>
          <p style={{color:'#64748b', marginBottom:'35px'}}>Ministerio de Alabanza</p>
          <div style={estilos.menuGrid}>
            <button style={estilos.cardMenuClaro} onClick={() => setPantalla('preparar')}><span>📝</span><b>Preparar</b></button>
            <button style={estilos.cardMenuClaro} onClick={() => setPantalla('ensayo')}><span>📖</span><b>Culto</b></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={estilos.fondoGeneral}>
       <div style={estilos.contenedorPrincipal}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px', width:'100%'}}>
              <button onClick={() => setPantalla('inicio')} style={estilos.btnAtras}>← Inicio</button>
              {pantalla === 'preparar' && (
                  <div style={{display:'flex', gap:'8px'}}>
                      <button onClick={enviarWhatsApp} style={estilos.btnWA}>WhatsApp</button>
                      <button onClick={async () => { if(window.confirm("¿Borrar plan?")) { await supabase.from('planes_culto').delete().eq('fecha', fecha.toISOString().split('T')[0]); setSetlist([]); setDirector(""); } }} style={estilos.btnBorrar}>Borrar</button>
                  </div>
              )}
          </div>

          {pantalla === 'preparar' && (
            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
              <div style={estilos.cajaCalendario}>
                  <style>{`
                    .react-calendar { border: none; width: 100%; border-radius: 12px; }
                    .react-calendar__tile { color: #000 !important; font-weight: bold; }
                    .react-calendar__tile:disabled { color: #ccc !important; }
                  `}</style>
                  <Calendar onChange={setFecha} value={fecha} />
                  <input type="text" placeholder="¿Quién dirige hoy?" value={director} onChange={(e) => setDirector(e.target.value)} style={estilos.inputDirCentrado} />
              </div>
              
              <div style={{width:'100%', display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                  <h4 style={{color:'#4da6ff'}}>PLAN DE CULTO</h4>
                  <button onClick={guardarPlan} style={estilos.btnMiniG}>💾 GUARDAR</button>
              </div>

              <div style={estilos.areaPlan}>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={setlist.map((i, idx) => i.id || idx)} strategy={verticalListSortingStrategy}>
                      {setlist.map(c => (
                          <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta}
                              cambiarCategoria={(id, cat) => setSetlist(setlist.map(item => item.id === id ? { ...item, categoria: cat } : item))}
                              quitarDelSetlist={(id) => setSetlist(setlist.filter(x => x.id !== id))} 
                          />
                      ))}
                    </SortableContext>
                  </DndContext>
              </div>

              <div style={estilos.divisor}>BIBLIOTECA</div>
              <input type="text" placeholder="🔍 Buscar canción..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={estilos.search} />
              {canciones.filter(c => (c.titulo||'').toLowerCase().includes(busqueda.toLowerCase())).slice(0, 8).map(c => (
                <div key={c.id} style={estilos.itemRepo}>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: '0.9rem', fontWeight: 'bold'}}>{c.titulo}</div>
                    <div style={{fontSize: '0.7rem', color: '#666'}}>{c.cantante || ''}</div>
                  </div>
                  <button onClick={() => setSetlist([...setlist, {...c, id: `set-${Date.now()}-${Math.random()}` }])} style={estilos.btnP}>+</button>
                </div>
              ))}
            </div>
          )}

          {pantalla === 'ensayo' && (
            <>
              <h2 style={{textAlign:'center', color:'#4da6ff'}}>{director || 'PLAN DE HOY'}</h2>
              {setlist.map(c => <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta} modoLectura={true} />)}
            </>
          )}
       </div>
    </div>
  );
}

const estilos = {
  fondoInicioClaro: { background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)', minHeight: '100vh', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed' },
  contenedorCentrado: { zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '400px' },
  marcoLogo: { width: '150px', height: '150px', borderRadius: '40px', overflow: 'hidden', margin: '15px 0', border: '3px solid #fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' },
  imagenLogo: { width: '100%', height: '100%', objectFit: 'cover' },
  menuGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '100%' },
  cardMenuClaro: { background: '#fff', border: 'none', borderRadius: '24px', padding: '20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#334155', fontWeight:'bold' },
  fondoGeneral: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' },
  contenedorPrincipal: { width: '100%', maxWidth: '450px', padding: '0 15px', boxSizing: 'border-box' },
  btnAtras: { background: '#222', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '10px' },
  btnWA: { background: '#25D366', color: '#fff', border: 'none', padding: '10px 12px', borderRadius: '10px', fontSize:'0.75rem', fontWeight:'bold' },
  btnBorrar: { background: '#ef4444', color: '#fff', border: 'none', padding: '10px 12px', borderRadius: '10px', fontSize:'0.75rem', fontWeight:'bold' },
  cajaCalendario: { background: '#fff', padding: '15px', borderRadius: '20px', marginBottom: '20px', width:'100%', boxSizing:'border-box', display:'flex', flexDirection:'column', alignItems:'center' },
  inputDirCentrado: { width: '100%', padding: '14px', marginTop: '15px', borderRadius: '12px', border: '1px solid #ddd', textAlign: 'center', fontWeight:'bold' },
  btnMiniG: { background: '#3b82f6', color: 'white', padding: '10px 15px', borderRadius: '10px', border: 'none', fontWeight: 'bold' },
  areaPlan: { background: '#0a0a0a', padding: '10px', borderRadius: '15px', width: '100%', boxSizing:'border-box' },
  headerNormal: { display: 'flex', padding: '16px', background: '#161616', borderRadius: '12px', marginBottom: '6px' },
  headerActivo: { display: 'flex', padding: '16px', background: '#1e3a8a', borderRadius: '12px 12px 0 0' },
  tag: { background: '#4da6ff', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', marginRight:'8px' },
  miniSelect: { background: '#222', color: '#fff', border: '1px solid #444', fontSize: '0.75rem', padding: '6px', borderRadius: '8px' },
  btnX: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.5rem' },
  contenido: { padding: '15px', background: '#050505', border: '1px solid #1e3a8a', borderRadius: '0 0 12px 12px' },
  filaControles: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  grupoControl: { display: 'flex', alignItems: 'center', gap: '8px', background: '#111', padding: '6px 10px', borderRadius: '10px' },
  btnT: { background: '#222', border: '1px solid #444', color: '#fff', padding: '6px 12px', borderRadius: '6px' },
  letraPre: { whiteSpace: 'pre-wrap', color: '#eee', fontFamily: 'monospace', lineHeight: '1.8' },
  divisor: { margin: '20px 0 10px', color: '#4da6ff', textAlign: 'center', fontWeight: 'bold' },
  search: { width: '100%', padding: '16px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '15px', marginBottom: '15px', boxSizing: 'border-box' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#111', borderRadius: '15px', marginBottom: '10px', alignItems:'center' },
  btnP: { background: '#3b82f6', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', border: 'none', fontSize: '1.5rem' }
}