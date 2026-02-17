import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// Librerías para Drag & Drop
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: ITEM DE CANCIÓN ---
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

  // Cargar Repertorio
  useEffect(() => {
    const traerCanciones = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true })
      if (data) setCanciones(data.map((c, i) => ({ ...c, id: c.id || `id-${i}` })));
    }
    traerCanciones()
  }, []);

  // CONSULTAR PLAN AL CAMBIAR FECHA
  useEffect(() => {
    const consultarPlan = async () => {
      const fechaISO = fecha.toISOString().split('T')[0];
      const { data, error } = await supabase.from('planes_culto').select('*').eq('fecha', fechaISO).maybeSingle();
      if (data) {
        setDirector(data.director);
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
    else alert("¡Plan guardado!");
  };

  return (
    <div style={estilos.pantalla}>
      <h2 style={estilos.logo}>🎸 Odre Nuevo</h2>
      
      <div style={estilos.seccionCalendario}>
          <Calendar onChange={setFecha} value={fecha} className="calendario-custom" />
          <div style={{marginTop: '10px'}}>
            <input 
                type="text" placeholder="Director..." value={director}
                onChange={(e) => setDirector(e.target.value)}
                style={estilos.inputDirector}
            />
          </div>
      </div>

      <header style={{paddingBottom: '10px'}}>
        <input type="text" placeholder="🔍 Buscar canción..." value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} style={estilos.buscador} />
      </header>

      <section style={{maxWidth: '500px', margin: '0 auto'}}>
        <h3 style={estilos.subtitulo}>📅 PLAN DEL DÍA ({setlist.length})</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {setlist.map((c) => (
              <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta}
                quitarDelSetlist={(id) => setSetlist(setlist.filter(item => item.id !== id))} />
            ))}
          </SortableContext>
        </DndContext>

        <button onClick={guardarEnBaseDeDatos} style={estilos.btnGuardar}>💾 ACTUALIZAR PLAN</button>

        <div style={estilos.divisor}>REPERTORIO</div>
        <div style={estilos.grid}>
          {canciones.filter(c => c.titulo.toLowerCase().includes(busqueda.toLowerCase())).map((c) => (
            <div key={c.id} style={estilos.itemRepo}>
              <span style={{fontSize: '0.8rem'}}>{c.titulo} <small style={{color: '#4da6ff'}}>({c.tono || c.key})</small></span>
              <button onClick={() => agregarAlSetlist(c)} style={estilos.btnPlus}>+</button>
            </div>
          ))}
        </div>
      </section>
      
      <style>{`
        .calendario-custom { width: 100% !important; border: none !important; border-radius: 8px; font-size: 0.8rem; background: white !important; color: black !important; }
        .react-calendar__tile { color: black !important; padding: 8px !important; }
        .react-calendar__navigation button { color: black !important; font-weight: bold; }
      `}</style>
    </div>
  )
}

const estilos = {
  pantalla: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '10px', fontFamily: 'sans-serif' },
  logo: { color: '#4da6ff', fontSize: '1.1rem', textAlign: 'center', margin: '5px 0' },
  buscador: { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: '0.8rem' },
  seccionCalendario: { background: '#fff', padding: '10px', borderRadius: '10px', marginBottom: '15px' },
  inputDirector: { width: '90%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '0.8rem', color: '#000' },
  subtitulo: { color: '#888', fontSize: '0.65rem', marginBottom: '8px', letterSpacing: '1px' },
  acordeonHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#161616' },
  acordeonHeaderActivo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#1a3a5a' },
  tituloAcordeon: { fontWeight: 'bold', display: 'flex', alignItems: 'center', fontSize: '0.75rem' },
  dragHandle: { marginRight: '8px', color: '#555', cursor: 'grab', fontSize: '1rem' },
  acordeonContent: { padding: '10px', background: '#050505' },
  letra: { whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: '1.3', fontFamily: 'monospace', color: '#ccc' },
  btnQuitar: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1rem' },
  miniTransporte: { display: 'flex', alignItems: 'center', gap: '3px', background: '#000', padding: '2px 5px', borderRadius: '10px', border: '1px solid #333' },
  btnXSmall: { background: 'none', border: 'none', color: '#4da6ff', fontSize: '0.8rem', fontWeight: 'bold' },
  btnGuardar: { width: '100%', padding: '10px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '10px' },
  divisor: { textAlign: 'center', color: '#444', margin: '20px 0 10px 0', fontSize: '0.5rem', letterSpacing: '2px' },
  grid: { display: 'flex', flexDirection: 'column', gap: '4px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#111', borderRadius: '6px' },
  btnPlus: { background: '#3b82f6', border: 'none', color: '#fff', width: '25px', height: '25px', borderRadius: '50%', fontSize: '1rem' }
}