const fileInput = document.getElementById('file-input');
const canvas = document.getElementById('pdf-canvas');
const context = canvas.getContext('2d');
const annotationCanvas = document.getElementById('annotation-canvas');
const annotationContext = annotationCanvas.getContext('2d');
const CanvasWrapper = document.getElementById('canvas-wrapper');
const penButton = document.getElementById('pen');
const highlighterButton = document.getElementById('highlighter');
const addTextButton = document.getElementById('add-text');
const eraserButton = document.getElementById('eraser');
const saveButton = document.getElementById('save');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
let penSize = 2;
let pdfDoc = null;
let pageNum = 1;
let tool = 'pen';
let drawing = false;
let annotations = [];
let scale = 1;

annotationCanvas.width = canvas.width;
annotationCanvas.height = canvas.height;
const openPdfButton = document.getElementById('open-pdf');
openPdfButton.addEventListener('click', () => {
    fileInput.click();
});


/*
* render uploaded PDF to use with canvas
*/


fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file.type !== 'application/pdf') {
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target.result);
        pdfData = await pdfjsLib.getDocument({ data: typedArray }).promise;
        renderPDF(pdfData);
    };
    reader.readAsArrayBuffer(file);
});


/* 
* controlling page numbers 
*/

prevPageButton.addEventListener('click', () => {
    // if page # less than 1, stop, otherwise move to previous page
    if (pageNum <= 1) return; 
    pageNum--;
    renderPDF(pdfData);
});

nextPageButton.addEventListener('click', async () => {
    if (!pdfData) return;
    const numPages = pdfData.numPages;
    // if page # greater than last page, stop, otherwise move to next page
    if (pageNum >= numPages) return;
    pageNum++;
    renderPDF(pdfData);
});

/* 
* different tools to use on PDF, maybe add zoom function **if that doesn't mess up input text
*/

function changeCursorStyle(cursor) {
    annotationCanvas.style.cursor = cursor;
}

penButton.addEventListener('click', () => {
    tool = 'pen';
    changeCursorStyle('crosshair');
});
highlighterButton.addEventListener('click', () => {
    tool = 'highlighter';
    changeCursorStyle('crosshair');
});

addTextButton.addEventListener('click', () => {
    tool = 'text-box';
    changeCursorStyle('crosshair');
});

eraserButton.addEventListener('click', () => {
    tool = 'eraser';
    changeCursorStyle('crosshair');
});


annotationCanvas.addEventListener('mousedown', (e) => {
    drawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === 'eraser') {
        eraseAnnotations(x, y, 15); 
    } else {
        annotations.push({ tool, penSize, points: [{ x, y }] });
    }
});

annotationCanvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const currentAnnotation = annotations[annotations.length - 1];
    if (tool === 'eraser') {
        eraseAnnotations(x, y, 15); 
    } else {
        currentAnnotation.points.push({ x, y });
        renderAnnotations();
    }
});

annotationCanvas.addEventListener('mouseup', () => drawing = false);

async function renderPDF(pdfDoc) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    annotationCanvas.width = viewport.width;
    annotationCanvas.height = viewport.height;

    const renderContext = {
        canvasContext: context,
        viewport: viewport,
    };
    await page.render(renderContext).promise;

    CanvasWrapper.style.display = 'inline-block';
}

function renderAnnotations() {
    // clear the canvas
    annotationContext.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

    for (const annotation of annotations) {
        const { tool, points } = annotation;
        // highlighter is transparent yellow, other tools should be black 
        // **pink is text right now
        annotationContext.strokeStyle = tool === 'highlighter' ? 'rgba(255, 255, 0, 0.5)' : 'black';
        
        // destination-out = erase, source-over is default setting
        annotationContext.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
       
        // events for tools drawing on the canvas
        // highlighter and pen are paths
        if (annotation.tool === 'pen' || annotation.tool === 'highlighter') {
        annotationContext.beginPath();
        annotationContext.moveTo(points[0].x, points[0].y);
        for (const point of points) {
            annotationContext.lineTo(point.x, point.y);
        }
        annotationContext.stroke();
    }   
        // trying to make this tool open a new inputbox at mouse click
        else if (annotation.tool === 'text-box') {
                annotationContext.fillStyle = "pink";
                var input = document.createElement("input");
                input.setAttribute('type', 'text');
                annotationContext.fillText(input, points[0].x, points[0].y);
        }
    }
}

function eraseAnnotations(x, y, radius) {
    annotations = annotations.filter((annotation) => {
        for (const point of annotation.points) {
            if (Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2) ) < radius) {
                return false;
            }
        }
        return true;
    });
    renderAnnotations();
}

window.jsPDF = window.jspdf.jsPDF;

saveButton.addEventListener('click', async () => {
    const exportScale = 4;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width * exportScale;
    tempCanvas.height = canvas.height * exportScale;
    const tempContext = tempCanvas.getContext('2d');
    tempContext.scale(exportScale, exportScale);

    await renderPDF(pdfData);

    // copy pdf
    tempContext.drawImage(canvas, 0, 0);

    if (!pdfData)  return;

    // prepare annotations, redraw them on temporary canvas that will be included in downloaded file
    for (const annotation of annotations) {
        tempContext.strokeStyle = annotation.tool === 'pen' ? 'black' : 'yellow';
        tempContext.lineWidth = annotation.tool === 'pen' ? 3 : 10;
        tempContext.beginPath();
        const [firstPoint, ...remainingPoints] = annotation.points;
        tempContext.moveTo(firstPoint.x, firstPoint.y);
 
        for (const point of remainingPoints) {
            tempContext.lineTo(point.x, point.y);
        }
        tempContext.stroke();
    }

    // can download complete pdf with markup
    const pdf = new jsPDF('p', 'pt', [tempCanvas.width, tempCanvas.height]);
    pdf.addImage(tempCanvas.toDataURL('image/png'), 'PNG', 0, 0, tempCanvas.width, tempCanvas.height);
    pdf.save('annotated.pdf');
});




