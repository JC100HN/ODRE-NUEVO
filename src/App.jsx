import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.6 : 1,
    marginBottom: '8px',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: '#111',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={estaAbierta ? estilos.headerActivo : estilos.headerNormal} onClick={() => setCancionAbierta(estaAbierta ? null : c.id)}>
        <div style={estilos.infoCuerpo}>
          {!modoLectura && <span {...attributes} {...listeners} style={estilos.manubrio} onClick={(e) => e.stopPropagation()}>☰</span>}
          <div style={{flex: 1}}>
                <div style={{fontSize: '0.9rem', color: '#fff', fontWeight: 'bold'}}>
                    {c.categoria && <span style={estilos.tag}>{c.categoria}</span>} {c.titulo} 
                </div>
                <div style={{fontSize: '0.75rem', color: '#4da6ff'}}>
                    Tono: {transponerIndividual(c.tono || c.key, misSemitonos)}
                </div>
          </div>
        </div>
        
        <div style={{display: 'flex', gap: '5px', alignItems: 'center'}} onClick={(e) => e.stopPropagation()}>
           {!modoLectura && (
             <>
                <select value={c.categoria || ""} onChange={(e) => cambiarCategoria(c.id, e.target.value)} style={estilos.miniSelect}>
                    <option value="">Tipo...</option>
                    {["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button onClick={() => quitarDelSetlist(c.id)} style={estilos.btnX}>×</button>
             </>
           )}
        </div>
      </div>

      {estaAbierta && (
        <div style={estilos.contenido}>
          <div style={estilos.controlesLetra}>
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

export default function App() {
  const [pantalla, setPantalla] = useState('principal');
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
      if (data) {
        setDirector(data.director || "");
        setSetlist(data.canciones || []);
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
      fecha: fechaISO, 
      director: director, 
      canciones: setlist 
    }, { onConflict: 'fecha' });

    if (error) alert("Error: " + error.message);
    else { alert("✅ Sincronizado correctamente"); setExistePlan(true); }
  };

  if (pantalla === 'ensayo') {
    return (
      <div style={estilos.fondo}>
        <div style={estilos.navEnsayo}>
            <button onClick={() => setPantalla('principal')} style={estilos.btnRegresar}>← Volver</button>
            <div style={{textAlign: 'right'}}>
                <div style={{fontSize: '0.6rem', color: '#4da6ff'}}>DIRECTOR</div>
                <div style={{fontSize: '1rem', color: '#fff', fontWeight: 'bold'}}>{director || '---'}</div>
            </div>
        </div>
        <div style={estilos.contenedor}>
            <h3 style={estilos.fechaEnsayo}>{fecha.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }).toUpperCase()}</h3>
            {setlist.map(c => (
                <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta} modoLectura={true} />
            ))}
        </div>
      </div>
    );
  }

  return (
    <div style={estilos.fondo}>
      <h2 style={estilos.logo}>🎸 Odre Nuevo</h2>
      <div style={estilos.cajaCalendario}>
        <Calendar onChange={setFecha} value={fecha} className="custom-calendar" />
        <input type="text" placeholder="¿Quién dirige hoy?" value={director} 
               onChange={(e) => setDirector(e.target.value)} style={estilos.inputDir} />
      </div>

      <div style={estilos.contenedor}>
        <button onClick={() => setPantalla('ensayo')} style={estilos.btnEnsayo}>📖 ABRIR MODO ENSAYO</button>

        <div style={estilos.headerPlan}>
            <h4 onClick={() => setPlanContraido(!planContraido)} style={{cursor:'pointer'}}>
                PLAN DE CULTO {planContraido ? '[+]' : '[-]'}
            </h4>
            <button onClick={guardarPlan} style={estilos.btnMiniG}>💾 GUARDAR PLAN</button>
        </div>
        
        {!planContraido && (
            <div style={estilos.areaPlan}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
                    const { active, over } = e;
                    if (active.id !== over.id) {
                        setSetlist((items) => {
                            const oldIndex = items.findIndex((i) => i.id === active.id);
                            const newIndex = items.findIndex((i) => i.id === over.id);
                            return arrayMove(items, oldIndex, newIndex);
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
        )}

        <div style={estilos.divisor}>BIBLIOTECA</div>
        <input type="text" placeholder="🔍 Buscar alabanza..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={estilos.search} />
        
        <div style={estilos.tabs}>
            {['Alabanza', 'Adoración'].map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)} style={filtroTipo === t ? estilos.tabActiva : estilos.tabInactiva}>{t}</button>
            ))}
        </div>

        {canciones.filter(c => (c.titulo + c.artista).toLowerCase().includes(busqueda.toLowerCase())).filter(c => (c.tipo || 'Alabanza') === filtroTipo).map(c => (
          <div key={c.id} style={estilos.itemRepo}>
            <div style={{flex: 1}}>
              <div style={{fontSize: '0.85rem', fontWeight: 'bold'}}>{c.titulo}</div>
              <div style={{fontSize: '0.65rem', color: '#888'}}>{c.artista}</div>
            </div>
            <button onClick={() => setSetlist([...setlist, {...c, id: `set-${Date.now()}-${Math.random()}`, categoria: ''}])} style={estilos.btnP}>+</button>
          </div>
        ))}
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
  fondo: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '10px', boxSizing: 'border-box', fontFamily: 'sans-serif' },
  contenedor: { maxWidth: '500px', margin: '0 auto', width: '100%' },
  logo: { textAlign: 'center', color: '#4da6ff', letterSpacing: '2px' },
  cajaCalendario: { background: '#fff', padding: '10px', borderRadius: '15px', marginBottom: '15px' },
  inputDir: { width: '100%', padding: '12px', marginTop: '10px', borderRadius: '8px', border: '2px solid #3b82f6', color: '#000', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' },
  btnEnsayo: { width: '100%', padding: '18px', background: '#3b82f6', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', marginBottom: '20px', cursor: 'pointer', fontSize: '1rem' },
  navEnsayo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid #333', position: 'sticky', top: 0, background: '#000', zIndex: 10 },
  btnRegresar: { background: '#333', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px' },
  fechaEnsayo: { textAlign: 'center', fontSize: '0.9rem', color: '#888', margin: '20px 0' },
  headerPlan: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#4da6ff', marginBottom: '10px' },
  btnMiniG: { background: '#10b981', color: 'white', padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '0.8rem' },
  areaPlan: { background: '#0a0a0a', padding: '10px', borderRadius: '12px' },
  headerNormal: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#161616', borderRadius: '8px', marginBottom: '4px' },
  headerActivo: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#1e3a8a', borderRadius: '8px 8px 0 0' },
  infoCuerpo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  manubrio: { fontSize: '1.4rem', color: '#555' },
  tag: { background: '#4da6ff', color: '#000', padding: '2px 5px', borderRadius: '3px', fontSize: '0.6rem', fontWeight: 'bold', textTransform: 'uppercase' },
  miniSelect: { background: '#222', color: '#fff', border: 'none', fontSize: '0.75rem', padding: '6px', borderRadius: '6px' },
  btnX: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.5rem', cursor: 'pointer' },
  contenido: { padding: '15px', background: '#050505', border: '1px solid #1e3a8a', borderRadius: '0 0 8px 8px', marginBottom: '8px' },
  controlesLetra: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  grupoControl: { display: 'flex', alignItems: 'center', gap: '8px', background: '#111', padding: '6px 10px', borderRadius: '8px' },
  btnT: { background: '#222', border: '1px solid #333', color: '#4da6ff', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold' },
  letraPre: { whiteSpace: 'pre-wrap', color: '#ddd', fontFamily: 'monospace', lineHeight: '1.6' },
  divisor: { margin: '25px 0 15px', color: '#4da6ff', fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem', borderBottom: '1px solid #222', paddingBottom: '5px' },
  search: { width: '100%', padding: '15px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '12px', marginBottom: '15px', boxSizing: 'border-box' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '15px' },
  tabActiva: { flex: 1, padding: '12px', background: '#4da6ff', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px' },
  tabInactiva: { flex: 1, padding: '12px', background: '#111', color: '#555', border: '1px solid #333', borderRadius: '10px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#111', borderRadius: '10px', marginBottom: '8px' },
  btnP: { background: '#3b82f6', border: 'none', color: '#fff', width: '35px', height: '35px', borderRadius: '50%', fontSize: '1.2rem', fontWeight: 'bold' }
}