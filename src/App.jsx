import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

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
    borderRadius: '8px',
    border: isDragging ? '2px solid #4da6ff' : '1px solid #333',
    backgroundColor: '#111',
    width: '100%',
    boxSizing: 'border-box',
    touchAction: isDragging ? 'none' : 'pan-y'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div 
        style={estaAbierta ? estilos.headerActivo : estilos.headerNormal} 
        {...attributes} 
        {...listeners}
        onClick={(e) => {
          if (!isDragging) setCancionAbierta(estaAbierta ? null : c.id);
        }}
      >
        <div style={estilos.infoCuerpo}>
          {!modoLectura && <span style={estilos.manubrio}>☰</span>}
          <div style={{flex: 1}}>
                <div style={{fontSize: '0.85rem', color: '#fff', fontWeight: 'bold'}}>
                    {c.categoria && <span style={estilos.tag}>{c.categoria}</span>} {c.titulo} 
                </div>
                <div style={{fontSize: '0.7rem', color: '#4da6ff'}}>
                    Tono: {transponerIndividual(c.tono || c.key, misSemitonos)} | 🎤 {c.cantante || c.vocal || 'Voz'}
                </div>
          </div>
        </div>
        
        {!modoLectura && (
            <div style={{display: 'flex', gap: '5px', alignItems: 'center'}} onClick={(e) => e.stopPropagation()}>
                <select 
                    value={c.categoria || ""} 
                    onChange={(e) => cambiarCategoria(c.id, e.target.value)} 
                    style={estilos.miniSelect}
                >
                    <option value="">Tipo...</option>
                    {["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button onClick={() => quitarDelSetlist(c.id)} style={estilos.btnX}>×</button>
            </div>
        )}
      </div>

      {estaAbierta && (
        <div style={estilos.contenido}>
          <div style={estilos.controlesLetra} onClick={(e) => e.stopPropagation()}>
            <div style={estilos.grupoControl}>
                <button onClick={() => setMisSemitonos(s => s - 1)} style={estilos.btnT}>-</button>
                <span style={{color: '#fff', fontSize:'0.8rem', minWidth:'20px', textAlign:'center'}}>{misSemitonos}</span>
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
  const [existePlan, setExistePlan] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('Alabanza');
  const [planContraido, setPlanContraido] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 2000, tolerance: 15 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
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
      if (data) setCanciones(data.map((c, i) => ({ ...c, id: c.id || `lib-${i}` })));
    };
    cargarBiblioteca();
  }, []);

  useEffect(() => {
    const cargarPlan = async () => {
      const fechaISO = fecha.toISOString().split('T')[0];
      const { data } = await supabase.from('planes_culto').select('*').eq('fecha', fechaISO).maybeSingle();
      if (data && data.canciones && data.canciones.length > 0) {
        setDirector(data.director || "");
        setSetlist(data.canciones);
        setExistePlan(true);
      } else {
        setDirector(""); setSetlist([]); setExistePlan(false);
      }
    };
    cargarPlan();
  }, [fecha]);

  const guardarPlan = async () => {
    const fechaISO = fecha.toISOString().split('T')[0];
    const { error } = await supabase.from('planes_culto').upsert({ 
      fecha: fechaISO, director, canciones: setlist 
    }, { onConflict: 'fecha' });
    if (error) alert("Error: " + error.message);
    else { alert("✅ Sincronizado"); setExistePlan(true); }
  };

  const borrarPlan = async () => {
    const password = window.prompt("Clave para borrar:");
    if (password === "1234") { 
      if (window.confirm("¿Borrar plan?")) {
        const fechaISO = fecha.toISOString().split('T')[0];
        const { error } = await supabase.from('planes_culto').delete().eq('fecha', fechaISO);
        if (!error) { setSetlist([]); setDirector(""); setExistePlan(false); alert("🗑️ Borrado"); }
      }
    }
  };

  const compartirWhatsApp = () => {
    const dia = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
    let mensaje = `🎸 *ORDEN DE CULTO - ITED*\n📅 *${dia}*\n👤 *Dirige:* ${director || '---'}\n\n`;
    const cats = ["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"];
    cats.forEach(cat => {
      const items = setlist.filter(c => c.categoria === cat);
      if (items.length > 0) {
        mensaje += `*${cat.toUpperCase()}*:\n`;
        items.forEach(c => mensaje += `• ${c.titulo} (${c.tono || c.key})\n`);
        mensaje += `\n`;
      }
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  if (pantalla === 'inicio') {
    return (
      <div style={estilos.fondoInicio}>
        <div style={estilos.overlay}>
           <div style={estilos.contenedorInicio}>
              <h1 style={estilos.logoLetra}>ITED</h1>
              <div style={estilos.marcoLogo}>
                <img src="https://raw.githubusercontent.com/JC100HN/ODRE-NUEVO/main/src/assets/logo%20odre%20nuevo.png" alt="logo" style={{width:'100%'}} />
              </div>
              <h2 style={estilos.subLogo}>MONTE ALEGRE</h2>
              <div style={estilos.gridMenu}>
                 <button onClick={() => setPantalla('preparar')} style={estilos.btnMenu}>📝 Preparar Plan</button>
                 <button onClick={() => setPantalla('ensayo')} style={estilos.btnMenu}>📖 Empezar Culto</button>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div style={estilos.fondo}>
      <div style={estilos.contenedor}>
        {pantalla === 'ensayo' ? (
          <div style={estilos.navEnsayo}>
            <button onClick={() => setPantalla('inicio')} style={estilos.btnRegresar}>←</button>
            <div style={{textAlign: 'right'}}>
                <div style={{fontSize: '0.6rem', color: '#4da6ff'}}>DIRECTOR</div>
                <div style={{fontSize: '1.1rem', color: '#fff', fontWeight: 'bold'}}>{director || '---'}</div>
            </div>
          </div>
        ) : (
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
            <button onClick={() => setPantalla('inicio')} style={estilos.btnRegresar}>← Inicio</button>
            <h2 style={estilos.logo}>🎸 ITED</h2>
          </div>
        )}

        {pantalla === 'preparar' && (
          <>
            <div style={estilos.cajaCalendario}>
                <Calendar onChange={setFecha} value={fecha} className="custom-calendar" />
                <input type="text" placeholder="¿Quién dirige?" value={director} 
                    onChange={(e) => setDirector(e.target.value)} style={estilos.inputDir} />
            </div>
            <div style={estilos.headerPlan}>
                <h4 onClick={() => setPlanContraido(!planContraido)} style={{cursor:'pointer', fontSize:'0.8rem'}}>PLAN {planContraido ? '[+]' : '[-]'}</h4>
                <div style={{display:'flex', gap:'5px'}}>
                   <button onClick={compartirWhatsApp} style={estilos.btnWA}>📲 Enviar</button>
                   <button onClick={borrarPlan} style={estilos.btnBorrar}>🗑️</button>
                   <button onClick={guardarPlan} style={estilos.btnMiniG}>💾 GUARDAR</button>
                </div>
            </div>
          </>
        )}

        {(!planContraido || pantalla === 'ensayo') && (
            <div style={estilos.areaPlan}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {setlist.map(c => (
                        <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta}
                            modoLectura={pantalla === 'ensayo'}
                            cambiarCategoria={(id, cat) => setSetlist(setlist.map(item => item.id === id ? { ...item, categoria: cat } : item))}
                            quitarDelSetlist={(id) => setSetlist(setlist.filter(x => x.id !== id))} 
                        />
                    ))}
                  </SortableContext>
                </DndContext>
            </div>
        )}

        {pantalla === 'preparar' && (
          <>
            <div style={estilos.divisor}>BIBLIOTECA</div>
            <input type="text" placeholder="🔍 Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={estilos.search} />
            <div style={estilos.tabs}>
                {['Alabanza', 'Adoración'].map(t => (
                    <button key={t} onClick={() => setFiltroTipo(t)} style={filtroTipo === t ? estilos.tabActiva : estilos.tabInactiva}>{t}</button>
                ))}
            </div>
            {canciones.filter(c => (c.titulo).toLowerCase().includes(busqueda.toLowerCase())).filter(c => (c.tipo || 'Alabanza') === filtroTipo).map(c => (
              <div key={c.id} style={estilos.itemRepo}>
                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.85rem', fontWeight: 'bold'}}>{c.titulo}</div>
                  <div style={{fontSize: '0.65rem', color: '#888'}}>{c.cantante || c.artista || 'Voz'}</div>
                </div>
                <button onClick={() => setSetlist([...setlist, {...c, id: `set-${Date.now()}-${Math.random()}`, categoria: ''}])} style={estilos.btnP}>+</button>
              </div>
            ))}
          </>
        )}
      </div>
      <style>{`
        .custom-calendar { width: 100% !important; border: none !important; color: black !important; border-radius: 10px; }
        .react-calendar__tile { color: black !important; padding: 12px 5px !important; }
        .react-calendar__navigation button { color: black !important; font-weight: bold; }
      `}</style>
    </div>
  )
}

const estilos = {
  fondoInicio: { 
    backgroundImage: 'url("https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1000")', 
    backgroundSize: 'cover', backgroundPosition: 'center', height: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0
  },
  overlay: { backgroundColor: 'rgba(0,0,0,0.75)', height: '100%', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  contenedorInicio: { textAlign: 'center', width: '90%', maxWidth: '400px' },
  logoLetra: { color: '#4da6ff', fontSize: '3.5rem', fontWeight: '900', margin: 0 },
  subLogo: { color: '#fff', fontSize: '1.2rem', letterSpacing: '4px', marginBottom: '40px' },
  marcoLogo: { width: '140px', margin: '20px auto', borderRadius: '35px', overflow: 'hidden', border: '3px solid #4da6ff' },
  gridMenu: { display: 'grid', gap: '20px' },
  btnMenu: { padding: '22px', borderRadius: '18px', border: 'none', background: '#4da6ff', color: '#000', fontWeight: 'bold', fontSize: '1.1rem' },

  fondo: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', width: '100%', padding: '15px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  contenedor: { maxWidth: '450px', width: '100%' },
  logo: { textAlign: 'center', color: '#4da6ff', margin: 0 },
  cajaCalendario: { background: '#fff', padding: '10px', borderRadius: '15px', marginBottom: '15px' },
  inputDir: { width: '100%', padding: '14px', marginTop: '10px', borderRadius: '8px', border: '2px solid #3b82f6', background: '#f0f0f0', color: '#000', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', boxSizing: 'border-box' },
  navEnsayo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #333', marginBottom: '20px', width: '100%' },
  btnRegresar: { background: '#222', color: '#fff', border: '1px solid #444', padding: '8px 15px', borderRadius: '10px', fontSize: '0.8rem' },
  headerPlan: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#4da6ff', marginBottom: '10px' },
  btnMiniG: { background: '#10b981', color: 'white', padding: '8px 12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '0.75rem' },
  btnWA: { background: '#25D366', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.75rem' },
  btnBorrar: { background: '#441111', color: '#ff4d4d', border: '1px solid #ff4d4d', padding: '8px 10px', borderRadius: '8px' },
  areaPlan: { background: '#0a0a0a', padding: '5px', borderRadius: '12px' },
  headerNormal: { display: 'flex', padding: '14px', background: '#161616', borderRadius: '8px', marginBottom: '4px' },
  headerActivo: { display: 'flex', padding: '14px', background: '#1e3a8a', borderRadius: '8px 8px 0 0' },
  infoCuerpo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  manubrio: { fontSize: '1.1rem', color: '#444' },
  tag: { background: '#4da6ff', color: '#000', padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', marginRight: '5px' },
  miniSelect: { background: '#222', color: '#fff', border: '1px solid #444', fontSize: '0.65rem', padding: '5px', borderRadius: '6px' },
  btnX: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.4rem' },
  contenido: { padding: '15px', background: '#050505', border: '1px solid #1e3a8a', borderRadius: '0 0 8px 8px' },
  controlesLetra: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  grupoControl: { display: 'flex', alignItems: 'center', gap: '10px', background: '#111', padding: '8px', borderRadius: '10px' },
  btnT: { background: '#222', border: '1px solid #333', color: '#4da6ff', padding: '6px 14px', borderRadius: '8px' },
  letraPre: { whiteSpace: 'pre-wrap', color: '#ddd', fontFamily: 'monospace', lineHeight: '1.7' },
  divisor: { margin: '25px 0 15px', color: '#4da6ff', textAlign: 'center', fontWeight: 'bold' },
  search: { width: '100%', padding: '15px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '12px', marginBottom: '15px', boxSizing: 'border-box' },
  tabs: { display: 'flex', gap: '10px', marginBottom: '15px' },
  tabActiva: { flex: 1, padding: '12px', background: '#4da6ff', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '12px' },
  tabInactiva: { flex: 1, padding: '12px', background: '#111', color: '#666', border: '1px solid #333', borderRadius: '12px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#111', borderRadius: '12px', marginBottom: '10px' },
  btnP: { background: '#3b82f6', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }
}