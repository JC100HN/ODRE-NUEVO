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
                    Tono: {transponerIndividual(c.tono || c.key, misSemitonos)}
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

  // Estados para Biblia
  const [citaBiblica, setCitaBiblica] = useState('');
  const [textoBiblico, setTextoBiblico] = useState('');
  const [cargandoBiblia, setCargandoBiblia] = useState(false);

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
      fecha: fechaISO, director: director, canciones: setlist 
    }, { onConflict: 'fecha' });
    if (error) alert("Error: " + error.message);
    else { alert("✅ Sincronizado"); setExistePlan(true); }
  };

  const borrarPlan = async () => {
    const password = window.prompt("Introduce la clave de administrador para borrar:");
    if (password === "1234") { 
      if (window.confirm("¿Borrar el plan?")) {
        const fechaISO = fecha.toISOString().split('T')[0];
        await supabase.from('planes_culto').delete().eq('fecha', fechaISO);
        setSetlist([]); setDirector(""); setExistePlan(false);
        alert("🗑️ Plan borrado");
      }
    }
  };

  const buscarBiblia = async () => {
    if (!citaBiblica) return;
    setCargandoBiblia(true);
    try {
      // API Gratuita en Español (Reina Valera)
      const res = await fetch(`https://bible-api.com/${citaBiblica}?translation=rvr09`);
      const data = await res.json();
      if (data.text) {
        setTextoBiblico(data.text);
      } else {
        alert("No se encontró la cita. Ej: 'Juan 3:16'");
      }
    } catch (e) {
      alert("Error al conectar con la Biblia");
    }
    setCargandoBiblia(false);
  };

  // --- VISTA: INICIO / MENÚ ---
  if (pantalla === 'inicio') {
    const urlLogo = "/logo_odre_nuevo.jpg"; // REEMPLAZA CON TU RUTA REAL

    return (
      <div style={estilos.fondoInicio}>
        <div style={estilos.fondoInstrumentos}>
          <span style={{...estilos.inst, top:'10%', left:'5%'}}>🎸</span>
          <span style={{...estilos.inst, top:'20%', right:'10%'}}>🎹</span>
          <span style={{...estilos.inst, bottom:'15%', left:'15%'}}>🥁</span>
          <span style={{...estilos.inst, bottom:'25%', right:'5%'}}>🎷</span>
          <span style={{...estilos.inst, top:'45%', left:'40%'}}>🎻</span>
        </div>

        <div style={estilos.contenedorInicio}>
          <div style={estilos.marcoLogo}>
            <img src={urlLogo} alt="Logo" style={estilos.imagenLogo} onError={(e) => e.target.src = 'https://via.placeholder.com/150?text=ODRE+NUEVO'} />
          </div>
          <h1 style={estilos.tituloApp}>ODRE NUEVO</h1>
          <p style={estilos.subtituloApp}>Alabanza y Adoración</p>
          
          <div style={estilos.menuGrid}>
            <button style={estilos.cardMenu} onClick={() => setPantalla('preparar')}>
              <span style={estilos.iconCard}>📝</span>
              <span style={estilos.textCard}>Preparar Culto</span>
            </button>
            <button style={estilos.cardMenu} onClick={() => setPantalla('ensayo')}>
              <span style={estilos.iconCard}>📖</span>
              <span style={estilos.textCard}>Empezar Culto</span>
            </button>
            <button style={estilos.cardMenu} onClick={() => setPantalla('biblia')}>
              <span style={estilos.iconCard}>📜</span>
              <span style={estilos.textCard}>Lectura Bíblica</span>
            </button>
            <button style={estilos.cardMenu} onClick={() => alert("Próximamente...")}>
              <span style={estilos.iconCard}>⚙️</span>
              <span style={estilos.textCard}>Ajustes</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA: BIBLIA ---
  if (pantalla === 'biblia') {
    return (
      <div style={estilos.fondo}>
        <div style={estilos.contenedor}>
          <button onClick={() => setPantalla('inicio')} style={estilos.btnAtras}>← Inicio</button>
          <h2 style={estilos.logo}>Lectura Bíblica</h2>
          <div style={estilos.cajaBiblia}>
            <input 
              type="text" 
              placeholder="Ej: Juan 3:16" 
              value={citaBiblica} 
              onChange={(e) => setCitaBiblica(e.target.value)} 
              style={estilos.search}
            />
            <button onClick={buscarBiblia} style={estilos.btnEnsayo}>
              {cargandoBiblia ? "Buscando..." : "Buscar Versículo"}
            </button>
          </div>
          {textoBiblico && (
            <div style={estilos.areaPlan}>
              <p style={{fontSize: '1.2rem', lineHeight: '1.8', color: '#fff'}}>{textoBiblico}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VISTA: PREPARAR CULTO ---
  if (pantalla === 'preparar') {
    return (
      <div style={estilos.fondo}>
        <div style={estilos.contenedor}>
          <button onClick={() => setPantalla('inicio')} style={estilos.btnAtras}>← Inicio</button>
          <h2 style={estilos.logo}>Preparar Culto</h2>
          <div style={estilos.cajaCalendario}>
              <Calendar onChange={setFecha} value={fecha} className="custom-calendar" />
              <input type="text" placeholder="¿Quién dirige?" value={director} 
                  onChange={(e) => setDirector(e.target.value)} style={estilos.inputDir} />
          </div>
          <div style={estilos.headerPlan}>
              <h4 onClick={() => setPlanContraido(!planContraido)} style={{cursor:'pointer', fontSize:'0.8rem'}}>PLAN {planContraido ? '[+]' : '[-]'}</h4>
              <div style={{display:'flex', gap:'5px'}}>
                 {existePlan && <button onClick={borrarPlan} style={estilos.btnBorrar}>🗑️</button>}
                 <button onClick={guardarPlan} style={estilos.btnMiniG}>💾 GUARDAR</button>
              </div>
          </div>
          {!planContraido && (
              <div style={estilos.areaPlan}>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
          )}
          <div style={estilos.divisor}>BIBLIOTECA</div>
          <input type="text" placeholder="🔍 Buscar canción..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={estilos.search} />
          <div style={estilos.tabs}>
              {['Alabanza', 'Adoración'].map(t => (
                  <button key={t} onClick={() => setFiltroTipo(t)} style={filtroTipo === t ? estilos.tabActiva : estilos.tabInactiva}>{t}</button>
              ))}
          </div>
          {canciones.filter(c => (c.titulo).toLowerCase().includes(busqueda.toLowerCase())).filter(c => (c.tipo || 'Alabanza') === filtroTipo).map(c => (
            <div key={c.id} style={estilos.itemRepo}>
              <div style={{flex: 1}}>
                <div style={{fontSize: '0.85rem', fontWeight: 'bold'}}>{c.titulo}</div>
                <div style={{fontSize: '0.65rem', color: '#888'}}>{c.artista}</div>
              </div>
              <button onClick={() => setSetlist([...setlist, {...c, id: `set-${Date.now()}-${Math.random()}`, categoria: ''}])} style={estilos.btnP}>+</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- VISTA: ENSAYO ---
  if (pantalla === 'ensayo') {
    return (
      <div style={estilos.fondo}>
        <div style={estilos.navEnsayo}>
            <button onClick={() => setPantalla('inicio')} style={estilos.btnRegresar}>← Inicio</button>
            <div style={{textAlign: 'right'}}>
                <div style={{fontSize: '0.6rem', color: '#4da6ff'}}>DIRECTOR</div>
                <div style={{fontSize: '1.1rem', color: '#fff', fontWeight: 'bold'}}>{director || '---'}</div>
            </div>
        </div>
        <div style={estilos.contenedor}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {setlist.map(c => (
                    <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta} modoLectura={true} />
                ))}
              </SortableContext>
            </DndContext>
        </div>
      </div>
    );
  }
}

const estilos = {
  fondo: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  fondoInicio: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  fondoInstrumentos: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' },
  inst: { position: 'absolute', fontSize: '5rem', opacity: 0.1, filter: 'blur(2px)' },
  contenedorInicio: { zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '400px' },
  marcoLogo: { width: '150px', height: '150px', borderRadius: '25px', overflow: 'hidden', marginBottom: '20px', border: '2px solid #4da6ff', boxShadow: '0 0 15px rgba(77,166,255,0.4)' },
  imagenLogo: { width: '100%', height: '100%', objectFit: 'cover' },
  tituloApp: { fontSize: '2rem', fontWeight: 'bold', color: '#4da6ff', letterSpacing: '2px', margin: '5px 0' },
  subtituloApp: { fontSize: '0.8rem', color: '#888', marginBottom: '30px' },
  menuGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '100%' },
  cardMenu: { background: '#111', border: '1px solid #333', borderRadius: '15px', padding: '20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  iconCard: { fontSize: '1.8rem' },
  textCard: { fontSize: '0.75rem', fontWeight: 'bold', color: '#ddd' },
  btnAtras: { alignSelf: 'flex-start', background: '#222', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', marginBottom: '10px', fontSize: '0.8rem' },
  contenedor: { maxWidth: '450px', width: '100%' },
  logo: { color: '#4da6ff', marginBottom: '15px', textAlign: 'center' },
  cajaCalendario: { background: '#fff', padding: '10px', borderRadius: '15px', marginBottom: '15px' },
  inputDir: { width: '100%', padding: '12px', marginTop: '10px', borderRadius: '8px', border: '2px solid #3b82f6', background: '#f0f0f0', color: '#000', textAlign: 'center', fontWeight: 'bold' },
  headerPlan: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  btnMiniG: { background: '#10b981', color: 'white', padding: '8px 12px', borderRadius: '8px', border: 'none', fontWeight: 'bold' },
  btnBorrar: { background: '#441111', color: '#ff4d4d', border: 'none', padding: '8px 10px', borderRadius: '8px' },
  areaPlan: { background: '#0a0a0a', padding: '10px', borderRadius: '12px' },
  headerNormal: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#161616', borderRadius: '8px', marginBottom: '4px' },
  headerActivo: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#1e3a8a', borderRadius: '8px 8px 0 0' },
  infoCuerpo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  tag: { background: '#4da6ff', color: '#000', padding: '1px 4px', borderRadius: '3px', fontSize: '0.55rem', fontWeight: 'bold' },
  miniSelect: { background: '#222', color: '#fff', border: '1px solid #444', fontSize: '0.65rem', padding: '4px', borderRadius: '5px' },
  btnX: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.2rem' },
  contenido: { padding: '15px', background: '#050505', border: '1px solid #1e3a8a', borderRadius: '0 0 8px 8px' },
  controlesLetra: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  grupoControl: { display: 'flex', alignItems: 'center', gap: '8px', background: '#111', padding: '6px 10px', borderRadius: '8px' },
  btnT: { background: '#222', border: '1px solid #333', color: '#4da6ff', padding: '6px 12px', borderRadius: '6px' },
  letraPre: { whiteSpace: 'pre-wrap', color: '#ddd', fontFamily: 'monospace', lineHeight: '1.6' },
  divisor: { margin: '20px 0 10px', color: '#4da6ff', textAlign: 'center', fontSize: '0.8rem' },
  search: { width: '100%', padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '10px', marginBottom: '10px', boxSizing: 'border-box' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '15px' },
  tabActiva: { flex: 1, padding: '10px', background: '#4da6ff', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px' },
  tabInactiva: { flex: 1, padding: '10px', background: '#111', color: '#555', border: '1px solid #333', borderRadius: '10px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#111', borderRadius: '10px', marginBottom: '8px' },
  btnP: { background: '#3b82f6', border: 'none', color: '#fff', width: '35px', height: '35px', borderRadius: '50%', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnEnsayo: { width: '100%', padding: '15px', background: '#3b82f6', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold' },
  navEnsayo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', width: '100%', borderBottom: '1px solid #333' },
  btnRegresar: { background: '#222', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px' },
  cajaBiblia: { marginBottom: '20px' }
}