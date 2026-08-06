import {PDFDocument, degrees, rgb, StandardFonts, PDFTextField, PDFCheckBox} from 'pdf-lib';
import {PDFField} from 'pdf-lib'
import * as fs from 'node:fs/promises';

const charInfo = new Map<string, any>();
let value = undefined;

// TODO will need to change this to the browser version when publishing to website
const PDFInput = await fs.readFile("C:/Users/willi/WebstormProjects/ThrumpCharacterManager/Thrump.pdf");
const charSheet = await PDFDocument.load(PDFInput);
const form = charSheet.getForm()

const fields = form.getFields()
fields.forEach(field => {
    const name = field.getName()

    if (field instanceof PDFTextField){
        value = (form.getTextField(name).getText())
    }
    else if (field instanceof PDFCheckBox){
        value = (form.getCheckBox(name).isChecked())
    }
    else {
        value = undefined
    }
    charInfo.set(name, value)
})

console.log(charInfo)