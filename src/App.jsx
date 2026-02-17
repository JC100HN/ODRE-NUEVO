import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// Librerías para Drag & Drop
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: CADA CANCIÓN EN EL PLAN ---
function ItemSortable({ c, cancionAbierta, setCancionAbierta, quitarDelSetlist }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const [misSemitonos, setMisSemitonos] = useState(0);
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
    marginBottom: '5px',
    borderRadius: '6px',
    border: '1px solid #333',
    backgroundColor: '#111',
    overflow: 'hidden'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={estaAbierta ? estilos.acordeonHeaderActivo : estilos.acordeonHeader} onClick={() => setCancionAbierta(estaAbierta ? null : c.id)}>
        <div style={estilos.tituloAcordeon}>
          <span {...attributes} {...listeners} style={estilos.dragHandle}>☰</span>
          <span style={{fontSize: '0.8rem'}}>{c.titulo} <b style={{color: '#4da6ff', fontSize: '0.7rem'}}>{transponerIndividual(c.tono || c.key, misSemitonos)}</b></span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
            <div style={estilos.miniTransporte} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setMisSemitonos(s => s - 1)} style={estilos.btnXSmall}>-</button>
                <span style={{fontSize: '0.6rem'}}>{misSemitonos}</span>
                <button onClick={() => setMisSemitonos(s => s + 1)} style={estilos.btnXSmall}>+</button>
            </div>
            <button onClick={(e) => { e.stopPropagation(); quitarDelSetlist(c.id); }} style={estilos.btnQuitar}>×</button>
        </div>
      </div>
      {estaAbierta && (
        <div style={estilos.acordeonContent}>
          <pre style={estilos.letra}>{transponerIndividual(c.letra || c.lyrics, misSemitonos)}</pre>
        </div>
      )}
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);
  const [setlist, setSetlist] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const traerCanciones = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true })
      if (data) setCanciones(data.map((c, i) => ({ ...c, id: c.id || `id-${i}` })));
    }
    traerCanciones()
  }, []);

  useEffect(() => {
    const consultarPlan = async () => {
      const fechaISO = fecha.toISOString().split('T')[0];
      const { data } = await supabase.from('planes_culto').select('*').eq('fecha', fechaISO).maybeSingle();
      if (data) {
        setDirector(data.director || "");
        setSetlist(data.canciones || []);
      } else {
        setDirector("");
        setSetlist([]);
      }
    };
    consultarPlan();
  }, [fecha]);

  const agregarAlSetlist = (cancion) => {
    setSetlist(prev => [...prev, { ...cancion, id: `${cancion.id}-${Date.now()}` }]);
  };

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

  const guardarEnBaseDeDatos = async () => {
    const fechaISO = fecha.toISOString().split('T')[0];
    const { error } = await supabase.from('planes_culto').upsert({ fecha: fechaISO, director: director, canciones: setlist });
    if (error) alert("Error: " + error.message);
    else alert("¡Plan guardado con éxito!");
  };

  return (
    <div style={estilos.pantalla}>
      <h2 style={estilos.logo}>🎸 Odre Nuevo</h2>
      
      <div style={estilos.seccionCalendario}>
          <Calendar onChange={setFecha} value={fecha} className="calendario-custom" />
          <div style={{marginTop: '12px', padding: '0 5px'}}>
            <label style={{color: '#555', fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '4px'}}>DIRECTOR DEL CULTO:</label>
            <input 
                type="text" 
                placeholder="Escribe el nombre aquí..." 
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                style={estilos.inputDirector}
            />
          </div>
      </div>

      <header style={{paddingBottom: '10px'}}>
        <input type="text" placeholder="🔍 Buscar en repertorio..." value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} style={estilos.buscador} />
      </header>

      <section style={{maxWidth: '500px', margin: '0 auto'}}>
        <h3 style={estilos.subtitulo}>📅 ORDEN DEL CULTO ({setlist.length})</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {setlist.map((c) => (
              <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta}
                quitarDelSetlist={(id) => setSetlist(setlist.filter(item => item.id !== id))} />
            ))}
          </SortableContext>
        </DndContext>

        {setlist.length > 0 && (
          <button onClick={guardarEnBaseDeDatos} style={estilos.btnGuardar}>💾 ACTUALIZAR PLAN</button>
        )}

        <div style={estilos.divisor}>BIBLIOTECA DE CANCIONES</div>
        <div style={estilos.grid}>
          {canciones.filter(c => (c.titulo || "").toLowerCase().includes(busqueda.toLowerCase())).map((c) => (
            <div key={c.id} style={estilos.itemRepo}>
              <span style={{fontSize: '0.8rem', textTransform: 'uppercase'}}>{c.titulo} <small style={{color: '#4da6ff'}}>({c.tono || c.key})</small></span>
              <button onClick={() => agregarAlSetlist(c)} style={estilos.btnPlus}>+</button>
            </div>
          ))}
        </div>
      </section>
      
      <style>{`
        .calendario-custom { width: 100% !important; border: none !important; border-radius: 8px; font-size: 0.85rem; background: white !important; color: black !important; }
        .react-calendar__tile { color: black !important; padding: 10px 5px !important; }
        .react-calendar__tile--now { background: #e6f2ff !important; border-radius: 5px; }
        .react-calendar__tile--active { background: #3b82f6 !important; color: white !important; border-radius: 5px; }
        .react-calendar__navigation button { color: black !important; font-weight: bold; font-size: 1rem; }
      `}</style>
    </div>
  )
}

const estilos = {
  pantalla: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '10px', fontFamily: 'sans-serif' },
  logo: { color: '#4da6ff', fontSize: '1.2rem', textAlign: 'center', margin: '10px 0', fontWeight: 'bold' },
  buscador: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' },
  seccionCalendario: { background: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' },
  inputDirector: { 
    width: '100%', 
    padding: '12px', 
    borderRadius: '8px', 
    border: '2px solid #3b82f6', 
    fontSize: '1rem', 
    color: '#000', 
    backgroundColor: '#f1f5f9',
    boxSizing: 'border-box'
  },
  subtitulo: { color: '#888', fontSize: '0.65rem', marginBottom: '10px', letterSpacing: '1px', textAlign: 'center' },
  acordeonHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#161616' },
  acordeonHeaderActivo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#1e3a8a' },
  tituloAcordeon: { fontWeight: 'bold', display: 'flex', alignItems: 'center', fontSize: '0.8rem' },
  dragHandle: { marginRight: '10px', color: '#666', cursor: 'grab', fontSize: '1.2rem' },
  acordeonContent: { padding: '12px', background: '#050505', borderTop: '1px solid #222' },
  letra: { whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: '1.4', fontFamily: 'monospace', color: '#ddd' },
  btnQuitar: { background: 'none', border: 'none', color: '#ef4444', fontSize: '1.2rem', fontWeight: 'bold' },
  miniTransporte: { display: 'flex', alignItems: 'center', gap: '4px', background: '#000', padding: '3px 8px', borderRadius: '12px', border: '1px solid #333' },
  btnXSmall: { background: 'none', border: 'none', color: '#4da6ff', fontSize: '1rem', fontWeight: 'bold' },
  btnGuardar: { width: '100%', padding: '14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '10px', cursor: 'pointer' },
  divisor: { textAlign: 'center', color: '#444', margin: '30px 0 15px 0', fontSize: '0.6rem', letterSpacing: '2px', fontWeight: 'bold' },
  grid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#111', borderRadius: '8px', border: '1px solid #222' },
  btnPlus: { background: '#3b82f6', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', fontSize: '1.2rem', fontWeight: 'bold' }
}