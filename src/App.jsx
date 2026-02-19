import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// LIBRERÍAS DE MOVIMIENTO (CORRECTAS PARA VERCEL)
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
    marginBottom: '8px',
    borderRadius: '12px',
    border: isDragging ? '2px solid #4da6ff' : '1px solid #333',
    backgroundColor: '#111',
    width: '100%',
    boxSizing: 'border-box',
    touchAction: 'none' // Importante para que el scroll no choque con el arrastre
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

// --- APP PRINCIPAL ---
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
      setTextoBiblico(data.text || "No se encontró.");
    } catch (e) { alert("Error"); }
  };

  if (pantalla === 'inicio') {
    return (
      <div style={estilos.fondoInicio}>
        <div style={estilos.centradorInicio}>
          <h1 style={estilos.tituloHome}>ITED</h1>
          <div style={estilos.marcoLogo}>
             <img src="https://raw.githubusercontent.com/JC100HN/ODRE-NUEVO/main/src/assets/logo%20odre%20nuevo.png" alt="Logo" style={estilos.imgLogo} />
          </div>
          <h2 style={estilos.subtituloHome}>MONTE ALEGRE</h2>
          <p style={estilos.textoHome}>Ministerio de Alabanza</p>
          <div style={estilos.menuBotones}>
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
          <div style={estilos.headerTop}>
              <button onClick={() => setPantalla('inicio')} style={estilos.btnBack}>← Inicio</button>
              {pantalla === 'preparar' && (
                  <div style={{display:'flex', gap:'8px'}}>
                      <button onClick={enviarWhatsApp} style={estilos.btnWA}>WhatsApp</button>
                      <button onClick={async () => { if(window.confirm("¿Borrar?")) { await supabase.from('planes_culto').delete().eq('fecha', fecha.toISOString().split('T')[0]); setSetlist([]); setDirector(""); } }} style={estilos.btnBorrar}>Borrar</button>
                  </div>
              )}
          </div>

          {pantalla === 'biblia' && (
            <div style={{width:'100%'}}>
              <h2 style={{color:'#4da6ff', textAlign:'center'}}>Buscador Bíblico 📜</h2>
              <div style={{display:'flex', gap:'8px', marginBottom:'15px'}}>
                  <input type="text" placeholder="Ej: Juan 3:16" value={citaBiblica} onChange={(e) => setCitaBiblica(e.target.value)} style={estilos.search} />
                  <button onClick={buscarBiblia} style={estilos.btnAccion}>🔍</button>
              </div>
              {textoBiblico && <div style={estilos.cajaContenido}><p>{textoBiblico}</p></div>}
            </div>
          )}

          {pantalla === 'preparar' && (
            <>
              <div style={estilos.cardBlanca}>
                  <style>{`
                    .react-calendar { width: 100% !important; border: none; font-family: sans-serif; }
                    .react-calendar__navigation button { color: #1e40af; font-weight: bold; font-size: 1.2rem; }
                    .react-calendar__month-view__days__day { color: #000 !important; font-weight: bold; }
                    .react-calendar__month-view__weekdays { color: #666; font-size: 0.8rem; }
                  `}</style>
                  <Calendar onChange={setFecha} value={fecha} />
                  <div style={{width:'100%', marginTop:'15px'}}>
                    <input type="text" placeholder="¿QUIÉN DIRIGE EL CULTO?" value={director} onChange={(e) => setDirector(e.target.value)} style={estilos.inputDirector} />
                  </div>
              </div>
              
              <div style={estilos.filaH4}>
                  <h4 style={{color:'#4da6ff', margin:0}}>ORDEN DEL CULTO</h4>
                  <button onClick={guardarPlan} style={estilos.btnSave}>💾 GUARDAR</button>
              </div>

              <div style={estilos.cajaPlanList}>
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
              <input type="text" placeholder="🔍 Buscar por nombre..." style={estilos.search} onChange={(e) => setBusqueda(e.target.value)} />
              
              <p style={estilos.catEtiqueta}>🎸 ALABANZA</p>
              {canciones.filter(c => c.tipo_ritmo === 'Alabanza' && c.titulo.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 6).map(c => (
                <div key={c.id} style={estilos.itemRepo}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 'bold', fontSize:'0.9rem'}}>{c.titulo}</div>
                    <div style={{fontSize: '0.7rem', color: '#888'}}>{c.cantante || 'Voz'}</div>
                  </div>
                  <button onClick={() => setSetlist([...setlist, {...c, id: `s-${Date.now()}-${c.id}`}])} style={estilos.btnPlus}>+</button>
                </div>
              ))}

              <p style={estilos.catEtiqueta}>🙏 ADORACIÓN</p>
              {canciones.filter(c => c.tipo_ritmo === 'Adoración' && c.titulo.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 6).map(c => (
                <div key={c.id} style={estilos.itemRepo}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 'bold', fontSize:'0.9rem'}}>{c.titulo}</div>
                    <div style={{fontSize: '0.7rem', color: '#888'}}>{c.cantante || 'Voz'}</div>
                  </div>
                  <button onClick={() => setSetlist([...setlist, {...c, id: `s-${Date.now()}-${c.id}`}])} style={estilos.btnPlus}>+</button>
                </div>
              ))}
            </>
          )}

          {pantalla === 'ensayo' && (
            <div style={{width:'100%'}}>
              <div style={{textAlign:'center', marginBottom:'30px'}}>
                <h2 style={{margin:0, color:'#4da6ff'}}>CULTO: {fecha.toLocaleDateString()}</h2>
                <p style={{color:'#fff', fontSize:'1.2rem'}}>Director: {director || '---'}</p>
              </div>
              {setlist.map(c => <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta} modoLectura={true} />)}
            </div>
          )}
       </div>
    </div>
  );
}

// --- SISTEMA DE ESTILOS MEJORADO ---
const estilos = {
  fondoInicio: { background: 'linear-gradient(135deg, #f0f9ff 0%, #c0e8ff 100%)', height: '100vh', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', top:0, left:0 },
  centradorInicio: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '400px' },
  tituloHome: { color:'#1e40af', fontWeight:'900', fontSize:'2.8rem', margin:0 },
  marcoLogo: { width: '160px', height: '160px', borderRadius: '45px', overflow: 'hidden', margin: '20px 0', border: '5px solid #fff', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' },
  imgLogo: { width: '100%', height: '100%', objectFit: 'cover' },
  subtituloHome: { color:'#1e40af', fontWeight:'900', fontSize:'1.8rem', margin:0 },
  textoHome: { color:'#64748b', marginBottom:'35px', fontWeight:'500' },
  menuBotones: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '100%' },
  btnHome: { background: '#fff', border: 'none', borderRadius: '25px', padding: '25px 10px', fontWeight:'bold', color: '#334155', boxShadow: '0 5px 15px rgba(0,0,0,0.05)' },
  
  fondoApp: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', width: '100%', padding: '20px 0' },
  container: { width: '92%', maxWidth: '450px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  headerTop: { display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '25px', alignItems: 'center' },
  btnBack: { background: '#111', color: '#fff', border: '1px solid #333', padding: '10px 18px', borderRadius: '12px' },
  btnWA: { background: '#25D366', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '12px', fontWeight: 'bold' },
  btnBorrar: { background: '#ef4444', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '12px', fontWeight: 'bold' },
  
  cardBlanca: { background: '#fff', padding: '20px', borderRadius: '25px', marginBottom: '25px', width: '100%', boxSizing: 'border-box' },
  inputDirector: { width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold', color: '#0f172a', fontSize: '1rem', backgroundColor: '#f1f5f9' },
  
  filaH4: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  btnSave: { background: '#3b82f6', color: '#fff', padding: '12px 20px', borderRadius: '15px', border: 'none', fontWeight: 'bold' },
  cajaPlanList: { width: '100%', background: '#080808', padding: '10px', borderRadius: '20px', marginBottom: '30px' },
  
  headerNormal: { display: 'flex', padding: '18px', background: '#161616', borderRadius: '15px' },
  headerActivo: { display: 'flex', padding: '18px', background: '#1e3a8a', borderRadius: '15px 15px 0 0' },
  tag: { background: '#4da6ff', color: '#000', padding: '3px 8px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 'bold', marginRight: '10px' },
  miniSelect: { background: '#222', color: '#fff', border: 'none', fontSize: '0.75rem', padding: '6px', borderRadius: '8px' },
  btnX: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.6rem', marginLeft: '10px' },
  
  contenido: { padding: '20px', background: '#050505', border: '1px solid #1e3a8a', borderRadius: '0 0 15px 15px' },
  filaControles: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' },
  grupoControl: { display: 'flex', gap: '10px', alignItems: 'center', background: '#111', padding: '8px 12px', borderRadius: '12px' },
  btnT: { background: '#222', border: '1px solid #444', color: '#fff', padding: '8px 15px', borderRadius: '8px' },
  letraPre: { whiteSpace: 'pre-wrap', color: '#eee', fontFamily: 'monospace', lineHeight: '1.8' },
  
  divisor: { margin: '40px 0 20px', color: '#4da6ff', fontWeight: 'bold', textAlign: 'center', letterSpacing: '3px', fontSize: '1.1rem' },
  search: { width: '100%', padding: '18px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '18px', boxSizing: 'border-box' },
  catEtiqueta: { color: '#4da6ff', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '25px', marginBottom: '12px', width:'100%' },
  itemRepo: { display: 'flex', padding: '18px', background: '#111', borderRadius: '18px', marginBottom: '12px', alignItems: 'center', width:'100%', boxSizing:'border-box' },
  btnPlus: { background: '#3b82f6', color: '#fff', border: 'none', width: '42px', height: '42px', borderRadius: '50%', fontSize: '1.6rem' },
  
  cajaContenido: { background: '#0a0a0a', padding: '25px', borderRadius: '20px', border: '1px solid #222', marginTop: '25px', lineHeight: '1.8' },
  btnAccion: { background: '#3b82f6', color: '#fff', border: 'none', padding: '15px 25px', borderRadius: '15px', fontWeight: 'bold' }
};