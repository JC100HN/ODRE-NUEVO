import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// LIBRERÍAS DE MOVIMIENTO (CORRECTAS PARA VERCEL)
import { DndContext, closestCenter, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: ITEM DE CANCIÓN (MANTIENE TODA LA LÓGICA) ---
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
                    Tono: {transponerIndividual(c.tono || c.key, misSemitonos)} | 🎤 {c.cantante || c.vocal || '---'}
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

// --- APP PRINCIPAL (CON TODAS LAS FUNCIONES RESTAURADAS) ---
export default function App() {
  const [pantalla, setPantalla] = useState('inicio');
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);
  const [setlist, setSetlist] = useState([]);
  const [citaBiblica, setCitaBiblica] = useState('');
  const [textoBiblico, setTextoBiblico] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 1000, tolerance: 10 } })
  );

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
    alert("✅ Plan Guardado en la Nube");
  };

  const enviarWhatsApp = () => {
    let mensaje = `*ITED MONTE ALEGRE*\n*PLAN: ${fecha.toLocaleDateString()}*\n*Dirige:* ${director || '---'}\n\n`;
    const categorias = ["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"];
    categorias.forEach(cat => {
        const filtradas = setlist.filter(c => c.categoria === cat);
        if (filtradas.length > 0) {
            mensaje += `*--- ${cat.toUpperCase()} ---*\n`;
            filtradas.forEach(c => {
                mensaje += `• ${c.titulo} (${c.tono || c.key}) - ${c.cantante || 'Voz'}\n`;
            });
            mensaje += `\n`;
        }
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const buscarBiblia = async () => {
    if (!citaBiblica) return;
    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(citaBiblica)}?translation=rvr09`);
      const data = await res.json();
      setTextoBiblico(data.text || "No se encontró el versículo.");
    } catch (e) { alert("Error al buscar en la Biblia"); }
  };

  if (pantalla === 'inicio') {
    return (
      <div style={estilos.fondoInicio}>
        <div style={estilos.contenedorInicio}>
          <h1 style={estilos.tituloPrincipal}>ITED</h1>
          <div style={estilos.logoFrame}>
             <img src="https://raw.githubusercontent.com/JC100HN/ODRE-NUEVO/main/src/assets/logo%20odre%20nuevo.png" alt="Logo" style={estilos.logoImg} />
          </div>
          <h2 style={estilos.subtituloPrincipal}>MONTE ALEGRE</h2>
          <p style={estilos.pInicio}>Ministerio de Alabanza</p>
          <div style={estilos.gridMenu}>
            <button style={estilos.btnMenu} onClick={() => setPantalla('preparar')}>📝<b>Preparar</b></button>
            <button style={estilos.btnMenu} onClick={() => setPantalla('ensayo')}>📖<b>Culto</b></button>
            <button style={estilos.btnMenu} onClick={() => setPantalla('biblia')}>📜<b>Biblia</b></button>
            <button style={estilos.btnMenu} onClick={() => alert("Próximamente")}>⚙️<b>Ajustes</b></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={estilos.fondoApp}>
       <div style={estilos.container}>
          <div style={estilos.headerNav}>
              <button onClick={() => setPantalla('inicio')} style={estilos.btnNav}>← Volver</button>
              {pantalla === 'preparar' && (
                  <div style={{display:'flex', gap:'8px'}}>
                      <button onClick={enviarWhatsApp} style={estilos.btnWA}>WhatsApp</button>
                      <button onClick={async () => { if(window.confirm("¿Borrar todo?")) { await supabase.from('planes_culto').delete().eq('fecha', fecha.toISOString().split('T')[0]); setSetlist([]); setDirector(""); } }} style={estilos.btnBorrar}>Borrar</button>
                  </div>
              )}
          </div>

          {pantalla === 'biblia' && (
            <div style={{width:'100%'}}>
              <h2 style={estilos.tituloSeccion}>Santa Biblia 📜</h2>
              <div style={{display:'flex', gap:'8px', marginBottom:'15px'}}>
                  <input type="text" placeholder="Ej: Salmos 23:1" value={citaBiblica} onChange={(e) => setCitaBiblica(e.target.value)} style={estilos.inputSearch} />
                  <button onClick={buscarBiblia} style={estilos.btnAccion}>🔍</button>
              </div>
              {textoBiblico && <div style={estilos.cajaBiblia}><p>{textoBiblico}</p></div>}
            </div>
          )}

          {pantalla === 'preparar' && (
            <>
              <div style={estilos.cajaCalendario}>
                  <style>{`
                    .react-calendar { border: none !important; width: 100% !important; background: #fff !important; color: #000 !important; }
                    .react-calendar__navigation button { color: #1e40af !important; font-weight: bold !important; font-size: 1.1rem !important; }
                    .react-calendar__month-view__days__day { color: #000 !important; font-weight: bold !important; }
                    .react-calendar__tile--now { background: #e0f2fe !important; }
                  `}</style>
                  <Calendar onChange={setFecha} value={fecha} />
                  <div style={{width:'100%', marginTop:'15px'}}>
                    <label style={{color:'#666', fontSize:'0.7rem', fontWeight:'bold', marginLeft:'5px'}}>DIRECTOR DEL CULTO:</label>
                    <input type="text" placeholder="Escribe el nombre aquí..." value={director} onChange={(e) => setDirector(e.target.value)} style={estilos.inputDirector} />
                  </div>
              </div>
              
              <div style={estilos.subHeader}>
                  <h4 style={{color:'#4da6ff', margin:0}}>PLANIFICACIÓN</h4>
                  <button onClick={guardarPlan} style={estilos.btnGuardar}>💾 GUARDAR</button>
              </div>

              <div style={estilos.listaPlan}>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
                    if (e.active.id !== e.over.id) {
                      setSetlist(items => {
                        const oldIdx = items.findIndex(i => i.id === e.active.id);
                        const newIdx = items.findIndex(i => i.id === e.over.id);
                        return arrayMove(items, oldIdx, newIdx);
                      });
                    }
                  }}>
                    <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
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
              <input type="text" placeholder="🔍 Buscar canción..." style={estilos.inputSearch} onChange={(e) => setBusqueda(e.target.value)} />
              
              <p style={estilos.etiquetaLib}>🎸 ALABANZAS</p>
              {canciones.filter(c => c.tipo_ritmo === 'Alabanza' && c.titulo.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 5).map(c => (
                <div key={c.id} style={estilos.itemLib}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 'bold', fontSize:'0.9rem'}}>{c.titulo}</div>
                    <div style={{fontSize: '0.75rem', color: '#666'}}>{c.cantante || 'Voz'}</div>
                  </div>
                  <button onClick={() => setSetlist([...setlist, {...c, id: `s-${Date.now()}-${c.id}`}])} style={estilos.btnAdd}>+</button>
                </div>
              ))}

              <p style={estilos.etiquetaLib}>🙏 ADORACIÓN</p>
              {canciones.filter(c => c.tipo_ritmo === 'Adoración' && c.titulo.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 5).map(c => (
                <div key={c.id} style={estilos.itemLib}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 'bold', fontSize:'0.9rem'}}>{c.titulo}</div>
                    <div style={{fontSize: '0.75rem', color: '#666'}}>{c.cantante || 'Voz'}</div>
                  </div>
                  <button onClick={() => setSetlist([...setlist, {...c, id: `s-${Date.now()}-${c.id}`}])} style={estilos.btnAdd}>+</button>
                </div>
              ))}
            </>
          )}

          {pantalla === 'ensayo' && (
            <div style={{width:'100%'}}>
              <div style={estilos.bannerEnsayo}>
                <h2 style={{margin:0, color:'#4da6ff'}}>CULTO DE HOY</h2>
                <p style={{margin:0, color:'#aaa'}}>Dirige: {director || '---'}</p>
              </div>
              {setlist.map(c => <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta} modoLectura={true} />)}
            </div>
          )}
       </div>
    </div>
  );
}

// --- ESTILOS (330+ LÍNEAS TOTAL) ---
const estilos = {
  fondoInicio: { background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)', minHeight: '100vh', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed' },
  contenedorInicio: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '400px', textAlign: 'center' },
  tituloPrincipal: { color:'#1e40af', fontWeight:'900', margin:0, fontSize:'2.5rem' },
  logoFrame: { width: '150px', height: '150px', borderRadius: '40px', overflow: 'hidden', margin: '20px 0', border: '4px solid #fff', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  subtituloPrincipal: { color:'#1e40af', fontWeight:'900', margin:0, fontSize:'1.8rem' },
  pInicio: { color:'#64748b', marginBottom:'30px', fontSize:'1.1rem' },
  gridMenu: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '100%' },
  btnMenu: { background: '#fff', border: 'none', borderRadius: '24px', padding: '25px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#334155', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' },
  
  fondoApp: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', width: '100%', padding: '20px 0' },
  container: { width: '92%', maxWidth: '450px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  headerNav: { display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '20px', alignItems: 'center' },
  btnNav: { background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '10px 15px', borderRadius: '12px' },
  btnWA: { background: '#25D366', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.8rem' },
  btnBorrar: { background: '#ef4444', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.8rem' },
  
  tituloSeccion: { color: '#4da6ff', textAlign: 'center', marginBottom: '20px' },
  cajaBiblia: { background: '#0a0a0a', padding: '20px', borderRadius: '15px', border: '1px solid #222', marginTop: '20px' },
  
  cajaCalendario: { background: '#fff', padding: '20px', borderRadius: '25px', marginBottom: '20px', width: '100%', boxSizing: 'border-box' },
  inputDirector: { width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', border: '2px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', backgroundColor: '#f8fafc' },
  
  subHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  btnGuardar: { background: '#3b82f6', color: '#fff', padding: '10px 15px', borderRadius: '12px', border: 'none', fontWeight: 'bold' },
  listaPlan: { width: '100%', background: '#050505', padding: '10px', borderRadius: '15px', marginBottom: '20px' },
  
  headerNormal: { display: 'flex', padding: '16px', background: '#161616', borderRadius: '12px' },
  headerActivo: { display: 'flex', padding: '16px', background: '#1e3a8a', borderRadius: '12px 12px 0 0' },
  tag: { background: '#4da6ff', color: '#000', padding: '3px 7px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', marginRight: '8px' },
  miniSelect: { background: '#222', color: '#fff', border: 'none', fontSize: '0.75rem', padding: '6px', borderRadius: '8px' },
  btnX: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.5rem', marginLeft: '5px' },
  
  contenido: { padding: '20px', background: '#050505', border: '1px solid #1e3a8a', borderRadius: '0 0 12px 12px' },
  filaControles: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  grupoControl: { display: 'flex', gap: '8px', alignItems: 'center', background: '#111', padding: '8px', borderRadius: '10px' },
  btnT: { background: '#222', border: '1px solid #444', color: '#fff', padding: '6px 12px', borderRadius: '6px' },
  letraPre: { whiteSpace: 'pre-wrap', color: '#eee', fontFamily: 'monospace', lineHeight: '1.8' },
  
  divisor: { margin: '30px 0 15px', color: '#4da6ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: '2px' },
  inputSearch: { width: '100%', padding: '16px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '15px', boxSizing: 'border-box' },
  etiquetaLib: { color: '#4da6ff', fontSize: '0.8rem', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px', marginLeft: '5px' },
  itemLib: { display: 'flex', padding: '16px', background: '#111', borderRadius: '15px', marginBottom: '10px', alignItems: 'center' },
  btnAdd: { background: '#3b82f6', color: '#fff', border: 'none', width: '38px', height: '38px', borderRadius: '50%', fontSize: '1.5rem' },
  
  bannerEnsayo: { textAlign: 'center', marginBottom: '25px', borderBottom: '1px solid #222', paddingBottom: '15px' },
  btnAccion: { background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold' }
};