export interface SubdistrictData {
  name: string;
  postalCode: string;
}

export interface DistrictData {
  name: string;
  subdistricts: SubdistrictData[];
}

export interface ProvinceData {
  name: string;
  districts: DistrictData[];
}

// 77 Provinces of Thailand with comprehensive district and subdistrict mapping
export const THAI_PROVINCES: ProvinceData[] = [
  {
    name: "กรุงเทพมหานคร",
    districts: [
      {
        name: "พระนคร",
        subdistricts: [
          { name: "พระบรมมหาราชวัง", postalCode: "10200" },
          { name: "วังบูรพาภิรมย์", postalCode: "10200" },
          { name: "วัดราชบพิธ", postalCode: "10200" },
          { name: "สำราญราษฎร์", postalCode: "10200" },
          { name: "ศาลเจ้าพ่อเสือ", postalCode: "10200" },
          { name: "เสาชิงช้า", postalCode: "10200" },
          { name: "บวรนิเวศ", postalCode: "10200" },
          { name: "ตลาดยอด", postalCode: "10200" },
          { name: "ชนะสงคราม", postalCode: "10200" },
          { name: "บ้านพานถม", postalCode: "10200" },
          { name: "บางขุนพรหม", postalCode: "10200" },
          { name: "วัดสามพระยา", postalCode: "10200" },
        ],
      },
      {
        name: "ดุสิต",
        subdistricts: [
          { name: "ดุสิต", postalCode: "10300" },
          { name: "วชิรพยาบาล", postalCode: "10300" },
          { name: "สวนจิตรลดา", postalCode: "10300" },
          { name: "สี่แยกมหานาค", postalCode: "10300" },
          { name: "ถนนนครไชยศรี", postalCode: "10300" },
        ],
      },
      {
        name: "ปทุมวัน",
        subdistricts: [
          { name: "รองเมือง", postalCode: "10330" },
          { name: "วังใหม่", postalCode: "10330" },
          { name: "ปทุมวัน", postalCode: "10330" },
          { name: "ลุมพินี", postalCode: "10330" },
        ],
      },
      {
        name: "บางรัก",
        subdistricts: [
          { name: "มหาพฤฒาราม", postalCode: "10500" },
          { name: "สีลม", postalCode: "10500" },
          { name: "สุริยวงศ์", postalCode: "10500" },
          { name: "บางรัก", postalCode: "10500" },
          { name: "สี่พระยา", postalCode: "10500" },
        ],
      },
      {
        name: "จตุจักร",
        subdistricts: [
          { name: "ลาดยาว", postalCode: "10900" },
          { name: "เสนานิคม", postalCode: "10900" },
          { name: "จันทรเกษม", postalCode: "10900" },
          { name: "จอมพล", postalCode: "10900" },
          { name: "จตุจักร", postalCode: "10900" },
        ],
      },
      {
        name: "บางเขน",
        subdistricts: [
          { name: "อนุสาวรีย์", postalCode: "10220" },
          { name: "ท่าแร้ง", postalCode: "10220" },
        ],
      },
      {
        name: "บางกะปิ",
        subdistricts: [
          { name: "คลองจั่น", postalCode: "10240" },
          { name: "หัวหมาก", postalCode: "10240" },
        ],
      },
      {
        name: "คลองเตย",
        subdistricts: [
          { name: "คลองเตย", postalCode: "10110" },
          { name: "คลองตัน", postalCode: "10110" },
          { name: "พระโขนง", postalCode: "10110" },
        ],
      },
      {
        name: "ธนบุรี",
        subdistricts: [
          { name: "วัดกัลยาณ์", postalCode: "10600" },
          { name: "หิรัญรูจี", postalCode: "10600" },
          { name: "บางยี่เรือ", postalCode: "10600" },
          { name: "บุคคโล", postalCode: "10600" },
          { name: "ตลาดพลู", postalCode: "10600" },
          { name: "ดาวคะนอง", postalCode: "10600" },
          { name: "สำเหร่", postalCode: "10600" },
        ],
      },
      {
        name: "บางกอกน้อย",
        subdistricts: [
          { name: "ศิริราช", postalCode: "10700" },
          { name: "บ้านช่างหล่อ", postalCode: "10700" },
          { name: "บางขุนนนท์", postalCode: "10700" },
          { name: "บางขุนศรี", postalCode: "10700" },
          { name: "อรุณอมรินทร์", postalCode: "10700" },
        ],
      },
      {
        name: "บางกอกใหญ่",
        subdistricts: [
          { name: "วัดอรุณ", postalCode: "10600" },
          { name: "วัดท่าพระ", postalCode: "10600" },
        ],
      },
      {
        name: "พญาไท",
        subdistricts: [
          { name: "สามเสนใน", postalCode: "10400" },
          { name: "พญาไท", postalCode: "10400" },
        ],
      },
      {
        name: "ราชเทวี",
        subdistricts: [
          { name: "ทุ่งพญาไท", postalCode: "10400" },
          { name: "ถนนพญาไท", postalCode: "10400" },
          { name: "ถนนเพชรบุรี", postalCode: "10400" },
          { name: "มักกะสัน", postalCode: "10400" },
        ],
      },
      {
        name: "ห้วยขวาง",
        subdistricts: [
          { name: "ห้วยขวาง", postalCode: "10310" },
          { name: "บางกะปิ", postalCode: "10310" },
          { name: "สามเสนนอก", postalCode: "10310" },
        ],
      },
      {
        name: "ดินแดง",
        subdistricts: [
          { name: "ดินแดง", postalCode: "10400" },
          { name: "รัชดาภิเษก", postalCode: "10400" },
        ],
      },
      {
        name: "วัฒนา",
        subdistricts: [
          { name: "คลองเตยเหนือ", postalCode: "10110" },
          { name: "คลองตันเหนือ", postalCode: "10110" },
          { name: "พระโขนงเหนือ", postalCode: "10110" },
        ],
      },
      {
        name: "ประเวศ",
        subdistricts: [
          { name: "ประเวศ", postalCode: "10250" },
          { name: "หนองบอน", postalCode: "10250" },
          { name: "ดอกไม้", postalCode: "10250" },
        ],
      },
      {
        name: "สายไหม",
        subdistricts: [
          { name: "สายไหม", postalCode: "10220" },
          { name: "ออเงิน", postalCode: "10220" },
          { name: "คลองถนน", postalCode: "10220" },
        ],
      },
      {
        name: "บางแค",
        subdistricts: [
          { name: "บางแค", postalCode: "10160" },
          { name: "บางแคเหนือ", postalCode: "10160" },
          { name: "บางไผ่", postalCode: "10160" },
          { name: "หลักสอง", postalCode: "10160" },
        ],
      },
      {
        name: "มีนบุรี",
        subdistricts: [
          { name: "มีนบุรี", postalCode: "10510" },
          { name: "แสนแสบ", postalCode: "10510" },
        ],
      },
    ],
  },
  {
    name: "กระบี่",
    districts: [
      { name: "เมืองกระบี่", subdistricts: [{ name: "ปากน้ำ", postalCode: "81000" }, { name: "กระบี่ใหญ่", postalCode: "81000" }, { name: "กระบี่น้อย", postalCode: "81000" }, { name: "อ่าวนาง", postalCode: "81180" }, { name: "หนองทะเล", postalCode: "81180" }] },
      { name: "เกาะลันตา", subdistricts: [{ name: "เกาะลันตาใหญ่", postalCode: "81150" }, { name: "เกาะลันตาน้อย", postalCode: "81150" }, { name: "ศาลาด่าน", postalCode: "81150" }] },
      { name: "เขาพนม", subdistricts: [{ name: "เขาพนม", postalCode: "81140" }, { name: "สินปุน", postalCode: "81140" }] },
      { name: "คลองท่อม", subdistricts: [{ name: "คลองท่อมใต้", postalCode: "81120" }, { name: "คลองท่อมเหนือ", postalCode: "81120" }, { name: "เพหลา", postalCode: "81120" }] },
      { name: "ปลายพระยา", subdistricts: [{ name: "ปลายพระยา", postalCode: "81160" }, { name: "เขาเขน", postalCode: "81160" }] },
      { name: "ลำทับ", subdistricts: [{ name: "ลำทับ", postalCode: "81190" }, { name: "ดินอุดม", postalCode: "81190" }] },
      { name: "อ่าวลึก", subdistricts: [{ name: "อ่าวลึกใต้", postalCode: "81110" }, { name: "อ่าวลึกเหนือ", postalCode: "81110" }] },
    ],
  },
  {
    name: "กาญจนบุรี",
    districts: [
      { name: "เมืองกาญจนบุรี", subdistricts: [{ name: "บ้านเหนือ", postalCode: "71000" }, { name: "บ้านใต้", postalCode: "71000" }, { name: "ปากแพรก", postalCode: "71000" }, { name: "ท่ามะขาม", postalCode: "71000" }, { name: "แก่งเสี้ยน", postalCode: "71000" }] },
      { name: "ไทรโยค", subdistricts: [{ name: "ท่าเสา", postalCode: "71150" }, { name: "ไทรโยค", postalCode: "71150" }] },
      { name: "บ่อพลอย", subdistricts: [{ name: "บ่อพลอย", postalCode: "71160" }, { name: "หนองกุ่ม", postalCode: "71160" }] },
      { name: "พนมทวน", subdistricts: [{ name: "พนมทวน", postalCode: "71140" }, { name: "รางหวาย", postalCode: "71140" }] },
      { name: "ท่าม่วง", subdistricts: [{ name: "ท่าม่วง", postalCode: "71110" }, { name: "วังขนาย", postalCode: "71110" }] },
      { name: "ทองผาภูมิ", subdistricts: [{ name: "ท่าขนุน", postalCode: "71180" }, { name: "ปิล็อก", postalCode: "71180" }] },
      { name: "สังขละบุรี", subdistricts: [{ name: "หนองลู", postalCode: "71240" }, { name: "ปรังเผล", postalCode: "71240" }] },
    ],
  },
  {
    name: "กาฬสินธุ์",
    districts: [
      { name: "เมืองกาฬสินธุ์", subdistricts: [{ name: "กาฬสินธุ์", postalCode: "46000" }, { name: "หลุบ", postalCode: "46000" }, { name: "โพนทอง", postalCode: "46000" }] },
      { name: "กมลาไสย", subdistricts: [{ name: "กมลาไสย", postalCode: "46130" }, { name: "หลักเมือง", postalCode: "46130" }] },
      { name: "ยางตลาด", subdistricts: [{ name: "ยางตลาด", postalCode: "46120" }, { name: "อุ่มเม่า", postalCode: "46120" }] },
      { name: "สมเด็จ", subdistricts: [{ name: "สมเด็จ", postalCode: "46150" }, { name: "หนองแวง", postalCode: "46150" }] },
      { name: "กุฉินารายณ์", subdistricts: [{ name: "บัวขาว", postalCode: "46110" }, { name: "แจนแลน", postalCode: "46110" }] },
    ],
  },
  {
    name: "กำแพงเพชร",
    districts: [
      { name: "เมืองกำแพงเพชร", subdistricts: [{ name: "ในเมือง", postalCode: "62000" }, { name: "ไตรตรึงษ์", postalCode: "62000" }, { name: "นครชุม", postalCode: "62000" }, { name: "หนองปลิง", postalCode: "62000" }] },
      { name: "คลองขลุง", subdistricts: [{ name: "คลองขลุง", postalCode: "62120" }, { name: "ท่ามะเขือ", postalCode: "62120" }] },
      { name: "พรานกระต่าย", subdistricts: [{ name: "พรานกระต่าย", postalCode: "62110" }, { name: "ถ้ำกระต่ายทอง", postalCode: "62110" }] },
      { name: "ขาณุวรลักษบุรี", subdistricts: [{ name: "ป่าพุทรา", postalCode: "62130" }, { name: "ยางสูง", postalCode: "62140" }] },
    ],
  },
  {
    name: "ขอนแก่น",
    districts: [
      {
        name: "เมืองขอนแก่น",
        subdistricts: [
          { name: "ในเมือง", postalCode: "40000" },
          { name: "ศิลา", postalCode: "40000" },
          { name: "บ้านเป็ด", postalCode: "40000" },
          { name: "เมืองเก่า", postalCode: "40000" },
          { name: "พระลับ", postalCode: "40000" },
          { name: "สาวะถี", postalCode: "40000" },
          { name: "ท่าพระ", postalCode: "40260" },
          { name: "สำราญ", postalCode: "40000" },
          { name: "โนนท่อน", postalCode: "40000" },
          { name: "แดงใหญ่", postalCode: "40000" },
        ],
      },
      { name: "กระนวน", subdistricts: [{ name: "หนองโก", postalCode: "40170" }, { name: "หนองกุงใหญ่", postalCode: "40170" }, { name: "ห้วยยาง", postalCode: "40170" }] },
      { name: "เขาสวนกวาง", subdistricts: [{ name: "เขาสวนกวาง", postalCode: "40280" }, { name: "ดงเมืองแอม", postalCode: "40280" }] },
      { name: "ชุมแพ", subdistricts: [{ name: "ชุมแพ", postalCode: "40130" }, { name: "โนนหัน", postalCode: "40290" }, { name: "หนองไผ่", postalCode: "40130" }] },
      { name: "น้ำพอง", subdistricts: [{ name: "น้ำพอง", postalCode: "40140" }, { name: "สะอาด", postalCode: "40140" }, { name: "วังชัย", postalCode: "40140" }] },
      { name: "บ้านไผ่", subdistricts: [{ name: "บ้านไผ่", postalCode: "40110" }, { name: "ในเมือง", postalCode: "40110" }, { name: "หนองน้ำใส", postalCode: "40110" }] },
      { name: "บ้านฝาง", subdistricts: [{ name: "บ้านฝาง", postalCode: "40270" }, { name: "หนองบัว", postalCode: "40270" }] },
      { name: "พล", subdistricts: [{ name: "เมืองพล", postalCode: "40120" }, { name: "โจดหนองแก", postalCode: "40120" }] },
      { name: "ภูเวียง", subdistricts: [{ name: "ภูเวียง", postalCode: "40150" }, { name: "เมืองเก่าพัฒนา", postalCode: "40150" }] },
      { name: "มัญจาคีรี", subdistricts: [{ name: "กุดเค้า", postalCode: "40160" }, { name: "สวนหม่อน", postalCode: "40160" }] },
      { name: "สีชมพู", subdistricts: [{ name: "สีชมพู", postalCode: "40220" }, { name: "วังเพิ่ม", postalCode: "40220" }] },
      { name: "หนองเรือ", subdistricts: [{ name: "หนองเรือ", postalCode: "40210" }, { name: "โนนทัน", postalCode: "40210" }, { name: "จระเข้", postalCode: "40240" }] },
      { name: "หนองสองห้อง", subdistricts: [{ name: "หนองสองห้อง", postalCode: "40190" }, { name: "ดงเค็ง", postalCode: "40190" }] },
      { name: "อุบลรัตน์", subdistricts: [{ name: "เขื่อนอุบลรัตน์", postalCode: "40250" }, { name: "โคกสูง", postalCode: "40250" }] },
    ],
  },
  {
    name: "จันทบุรี",
    districts: [
      { name: "เมืองจันทบุรี", subdistricts: [{ name: "ตลาด", postalCode: "22000" }, { name: "วัดใหม่", postalCode: "22000" }, { name: "ท่าช้าง", postalCode: "22000" }] },
      { name: "ขลุง", subdistricts: [{ name: "ขลุง", postalCode: "22110" }, { name: "บ่อ", postalCode: "22110" }] },
      { name: "ท่าใหม่", subdistricts: [{ name: "ท่าใหม่", postalCode: "22120" }, { name: "เขาบายศรี", postalCode: "22120" }] },
      { name: "โป่งน้ำร้อน", subdistricts: [{ name: "ทับไทร", postalCode: "22140" }, { name: "โป่งน้ำร้อน", postalCode: "22140" }] },
    ],
  },
  {
    name: "ฉะเชิงเทรา",
    districts: [
      { name: "เมืองฉะเชิงเทรา", subdistricts: [{ name: "หน้าเมือง", postalCode: "24000" }, { name: "บ้านใหม่", postalCode: "24000" }, { name: "บางตีนเป็ด", postalCode: "24000" }] },
      { name: "บางปะกง", subdistricts: [{ name: "บางปะกง", postalCode: "24130" }, { name: "บางวัว", postalCode: "24180" }, { name: "บางสมัคร", postalCode: "24180" }] },
      { name: "บ้านโพธิ์", subdistricts: [{ name: "บ้านโพธิ์", postalCode: "24140" }] },
      { name: "พนมสารคาม", subdistricts: [{ name: "พนมสารคาม", postalCode: "24120" }, { name: "เกาะขนุน", postalCode: "24120" }] },
    ],
  },
  {
    name: "ชลบุรี",
    districts: [
      { name: "เมืองชลบุรี", subdistricts: [{ name: "บางปลาสร้อย", postalCode: "20000" }, { name: "บ้านโขด", postalCode: "20000" }, { name: "แสนสุข", postalCode: "20130" }, { name: "เสม็ด", postalCode: "20000" }, { name: "อ่างศิลา", postalCode: "20000" }] },
      { name: "บางละมุง", subdistricts: [{ name: "บางละมุง", postalCode: "20150" }, { name: "หนองปรือ", postalCode: "20150" }, { name: "นาเกลือ", postalCode: "20150" }, { name: "ห้วยใหญ่", postalCode: "20150" }, { name: "หนองปลาไหล", postalCode: "20150" }] },
      { name: "ศรีราชา", subdistricts: [{ name: "ศรีราชา", postalCode: "20110" }, { name: "สุรศักดิ์", postalCode: "20110" }, { name: "ทุ่งสุขลา", postalCode: "20230" }, { name: "บ่อวิน", postalCode: "20230" }] },
      { name: "สัตหีบ", subdistricts: [{ name: "สัตหีบ", postalCode: "20180" }, { name: "นาจอมเทียน", postalCode: "20250" }, { name: "พลูตาหลวง", postalCode: "20180" }] },
      { name: "บ้านบึง", subdistricts: [{ name: "บ้านบึง", postalCode: "20170" }, { name: "คลองกิ่ว", postalCode: "20220" }] },
      { name: "พานทอง", subdistricts: [{ name: "พานทอง", postalCode: "20160" }, { name: "หนองตำลึง", postalCode: "20160" }] },
      { name: "พนัสนิคม", subdistricts: [{ name: "พนัสนิคม", postalCode: "20140" }, { name: "กุฎโง้ง", postalCode: "20140" }] },
      { name: "เกาะสีชัง", subdistricts: [{ name: "ท่าเทววงษ์", postalCode: "20120" }] },
    ],
  },
  {
    name: "ชัยนาท",
    districts: [
      { name: "เมืองชัยนาท", subdistricts: [{ name: "ในเมือง", postalCode: "17000" }, { name: "บ้านกล้วย", postalCode: "17000" }, { name: "ท่าชัย", postalCode: "17000" }] },
      { name: "มโนรมย์", subdistricts: [{ name: "คุ้งสำเภา", postalCode: "17110" }, { name: "วัดโคก", postalCode: "17110" }] },
      { name: "วัดสิงห์", subdistricts: [{ name: "วัดสิงห์", postalCode: "17120" }, { name: "มะขามเฒ่า", postalCode: "17120" }] },
      { name: "สรรพยา", subdistricts: [{ name: "สรรพยา", postalCode: "17150" }] },
      { name: "สรรคบุรี", subdistricts: [{ name: "แพรกศรีราชา", postalCode: "17140" }] },
      { name: "หันคา", subdistricts: [{ name: "หันคา", postalCode: "17130" }, { name: "สามง่ามท่าโบสถ์", postalCode: "17130" }] },
    ],
  },
  {
    name: "ชัยภูมิ",
    districts: [
      { name: "เมืองชัยภูมิ", subdistricts: [{ name: "ในเมือง", postalCode: "36000" }, { name: "รอบเมือง", postalCode: "36000" }, { name: "ชีลอง", postalCode: "36000" }] },
      { name: "เกษตรสมบูรณ์", subdistricts: [{ name: "บ้านยาง", postalCode: "36120" }, { name: "บ้านเดื่อ", postalCode: "36120" }] },
      { name: "แก้งคร้อ", subdistricts: [{ name: "ช่องสามหมอ", postalCode: "36150" }, { name: "หนองขาม", postalCode: "36150" }] },
      { name: "คอนสวรรค์", subdistricts: [{ name: "คอนสวรรค์", postalCode: "36140" }] },
      { name: "คอนสาร", subdistricts: [{ name: "คอนสาร", postalCode: "36180" }] },
      { name: "จัตุรัส", subdistricts: [{ name: "หนองบัวใหญ่", postalCode: "36130" }] },
      { name: "ภูเขียว", subdistricts: [{ name: "ผักปัง", postalCode: "36110" }, { name: "กวางโจน", postalCode: "36110" }] },
    ],
  },
  {
    name: "ชุมพร",
    districts: [
      { name: "เมืองชุมพร", subdistricts: [{ name: "ท่าตะเภา", postalCode: "86000" }, { name: "บางหมาก", postalCode: "86000" }, { name: "ปากน้ำ", postalCode: "86120" }] },
      { name: "หลังสวน", subdistricts: [{ name: "หลังสวน", postalCode: "86110" }, { name: "ขันเงิน", postalCode: "86110" }] },
      { name: "ปะทิว", subdistricts: [{ name: "บางสน", postalCode: "86160" }, { name: "ปะทิว", postalCode: "86160" }] },
      { name: "ท่าแซะ", subdistricts: [{ name: "ท่าแซะ", postalCode: "86140" }] },
    ],
  },
  {
    name: "เชียงราย",
    districts: [
      { name: "เมืองเชียงราย", subdistricts: [{ name: "เวียง", postalCode: "57000" }, { name: "รอบเวียง", postalCode: "57000" }, { name: "บ้านดู่", postalCode: "57100" }, { name: "ริมกก", postalCode: "57100" }] },
      { name: "แม่สาย", subdistricts: [{ name: "แม่สาย", postalCode: "57130" }, { name: "เวียงพางคำ", postalCode: "57130" }, { name: "เกาะช้าง", postalCode: "57130" }] },
      { name: "เชียงของ", subdistricts: [{ name: "เวียง", postalCode: "57140" }, { name: "สถาน", postalCode: "57140" }] },
      { name: "เชียงแสน", subdistricts: [{ name: "เวียง", postalCode: "57150" }, { name: "โยนก", postalCode: "57150" }] },
      { name: "แม่จัน", subdistricts: [{ name: "แม่จัน", postalCode: "57110" }, { name: "ป่าซาง", postalCode: "57110" }] },
      { name: "พาน", subdistricts: [{ name: "เมืองพาน", postalCode: "57120" }, { name: "ม่วงคำ", postalCode: "57120" }] },
      { name: "เทิง", subdistricts: [{ name: "เวียง", postalCode: "57160" }] },
    ],
  },
  {
    name: "เชียงใหม่",
    districts: [
      { name: "เมืองเชียงใหม่", subdistricts: [{ name: "ศรีภูมิ", postalCode: "50200" }, { name: "พระสิงห์", postalCode: "50200" }, { name: "หายยา", postalCode: "50100" }, { name: "ช้างม่อย", postalCode: "50300" }, { name: "ช้างคลาน", postalCode: "50100" }, { name: "สุเทพ", postalCode: "50200" }, { name: "นิมมานเหมินท์", postalCode: "50200" }] },
      { name: "สันทราย", subdistricts: [{ name: "สันทรายหลวง", postalCode: "50210" }, { name: "สันทรายน้อย", postalCode: "50210" }, { name: "หนองหาร", postalCode: "50290" }] },
      { name: "หางดง", subdistricts: [{ name: "หางดง", postalCode: "50230" }, { name: "หนองควาย", postalCode: "50230" }] },
      { name: "สารภี", subdistricts: [{ name: "ยางเนิ้ง", postalCode: "50140" }, { name: "สารภี", postalCode: "50140" }] },
      { name: "แม่ริม", subdistricts: [{ name: "ริมใต้", postalCode: "50180" }, { name: "แม่แรม", postalCode: "50180" }] },
      { name: "ฝาง", subdistricts: [{ name: "เวียง", postalCode: "50110" }, { name: "สันทราย", postalCode: "50110" }] },
      { name: "จอมทอง", subdistricts: [{ name: "บ้านหลวง", postalCode: "50160" }] },
    ],
  },
  {
    name: "ตรัง",
    districts: [
      { name: "เมืองตรัง", subdistricts: [{ name: "ทับเที่ยง", postalCode: "92000" }, { name: "นาบินหลา", postalCode: "92000" }, { name: "โคกหล่อ", postalCode: "92000" }] },
      { name: "กันตัง", subdistricts: [{ name: "กันตัง", postalCode: "92110" }, { name: "ควนธานี", postalCode: "92110" }] },
      { name: "ห้วยยอด", subdistricts: [{ name: "ห้วยยอด", postalCode: "92130" }, { name: "เขาขาว", postalCode: "92130" }] },
    ],
  },
  {
    name: "ตราด",
    districts: [
      { name: "เมืองตราด", subdistricts: [{ name: "บางพระ", postalCode: "23000" }, { name: "วังกระแจะ", postalCode: "23000" }, { name: "หนองโสน", postalCode: "23000" }] },
      { name: "เกาะช้าง", subdistricts: [{ name: "เกาะช้าง", postalCode: "23170" }, { name: "เกาะช้างใต้", postalCode: "23170" }] },
      { name: "คลองใหญ่", subdistricts: [{ name: "คลองใหญ่", postalCode: "23110" }, { name: "หาดเล็ก", postalCode: "23110" }] },
    ],
  },
  {
    name: "ตาก",
    districts: [
      { name: "เมืองตาก", subdistricts: [{ name: "ระแหง", postalCode: "63000" }, { name: "หนองหลวง", postalCode: "63000" }, { name: "น้ำรึม", postalCode: "63000" }] },
      { name: "แม่สอด", subdistricts: [{ name: "แม่สอด", postalCode: "63110" }, { name: "แม่ปะ", postalCode: "63110" }, { name: "ท่าสายลวด", postalCode: "63110" }] },
      { name: "แม่ระมาด", subdistricts: [{ name: "แม่ระมาด", postalCode: "63140" }] },
      { name: "บ้านตาก", subdistricts: [{ name: "ตากตก", postalCode: "63120" }, { name: "ตากออก", postalCode: "63120" }] },
    ],
  },
  {
    name: "นครนายก",
    districts: [
      { name: "เมืองนครนายก", subdistricts: [{ name: "นครนายก", postalCode: "26000" }, { name: "ท่าช้าง", postalCode: "26000" }, { name: "บ้านใหญ่", postalCode: "26000" }, { name: "สาริกา", postalCode: "26000" }, { name: "หินตั้ง", postalCode: "26000" }] },
      { name: "ปากพลี", subdistricts: [{ name: "ปากพลี", postalCode: "26130" }] },
      { name: "บ้านนา", subdistricts: [{ name: "บ้านนา", postalCode: "26110" }] },
      { name: "องครักษ์", subdistricts: [{ name: "องครักษ์", postalCode: "26120" }, { name: "คลองใหญ่", postalCode: "26120" }] },
    ],
  },
  {
    name: "นครปฐม",
    districts: [
      { name: "เมืองนครปฐม", subdistricts: [{ name: "พระปฐมเจดีย์", postalCode: "73000" }, { name: "บางแขม", postalCode: "73000" }, { name: "นครปฐม", postalCode: "73000" }, { name: "สนามจันทร์", postalCode: "73000" }] },
      { name: "กำแพงแสน", subdistricts: [{ name: "ทุ่งกระพังโหม", postalCode: "73140" }, { name: "กำแพงแสน", postalCode: "73140" }] },
      { name: "นครชัยศรี", subdistricts: [{ name: "นครชัยศรี", postalCode: "73120" }, { name: "งิ้วราย", postalCode: "73120" }] },
      { name: "ดอนตูม", subdistricts: [{ name: "สามง่าม", postalCode: "73150" }] },
      { name: "บางเลน", subdistricts: [{ name: "บางเลน", postalCode: "73130" }, { name: "บางหลวง", postalCode: "73190" }] },
      { name: "สามพราน", subdistricts: [{ name: "สามพราน", postalCode: "73110" }, { name: "ไร่ขิง", postalCode: "73210" }, { name: "อ้อมใหญ่", postalCode: "73160" }] },
      { name: "พุทธมณฑล", subdistricts: [{ name: "ศาลายา", postalCode: "73170" }, { name: "คลองโยง", postalCode: "73170" }] },
    ],
  },
  {
    name: "นครพนม",
    districts: [
      { name: "เมืองนครพนม", subdistricts: [{ name: "ในเมือง", postalCode: "48000" }, { name: "หนองญาติ", postalCode: "48000" }, { name: "อาจสามารถ", postalCode: "48000" }] },
      { name: "ธาตุพนม", subdistricts: [{ name: "ธาตุพนม", postalCode: "48110" }, { name: "ธาตุพนมเหนือ", postalCode: "48110" }] },
      { name: "ท่าอุเทน", subdistricts: [{ name: "ท่าอุเทน", postalCode: "48120" }] },
      { name: "บ้านแพง", subdistricts: [{ name: "บ้านแพง", postalCode: "48140" }] },
    ],
  },
  {
    name: "นครราชสีมา",
    districts: [
      { name: "เมืองนครราชสีมา", subdistricts: [{ name: "ในเมือง", postalCode: "30000" }, { name: "โพธิ์กลาง", postalCode: "30000" }, { name: "หนองจะบก", postalCode: "30000" }, { name: "หัวทะเล", postalCode: "30000" }, { name: "จอหอ", postalCode: "30310" }, { name: "สุรนารี", postalCode: "30000" }] },
      { name: "ปากช่อง", subdistricts: [{ name: "ปากช่อง", postalCode: "30130" }, { name: "หมูสี", postalCode: "30130" }, { name: "หนองน้ำแดง", postalCode: "30130" }, { name: "ขนงพระ", postalCode: "30130" }] },
      { name: "พิมาย", subdistricts: [{ name: "ในเมือง", postalCode: "30110" }, { name: "รังกาใหญ่", postalCode: "30110" }] },
      { name: "ปักธงชัย", subdistricts: [{ name: "เมืองปัก", postalCode: "30150" }, { name: "งิ้ว", postalCode: "30150" }] },
      { name: "โชคชัย", subdistricts: [{ name: "โชคชัย", postalCode: "30190" }] },
      { name: "สีคิ้ว", subdistricts: [{ name: "สีคิ้ว", postalCode: "30140" }, { name: "มิตรภาพ", postalCode: "30140" }] },
      { name: "ด่านขุนทด", subdistricts: [{ name: "ด่านขุนทด", postalCode: "30210" }] },
      { name: "โนนสูง", subdistricts: [{ name: "โนนสูง", postalCode: "30160" }] },
    ],
  },
  {
    name: "นครศรีธรรมราช",
    districts: [
      { name: "เมืองนครศรีธรรมราช", subdistricts: [{ name: "ในเมือง", postalCode: "80000" }, { name: "ท่าวัง", postalCode: "80000" }, { name: "คลัง", postalCode: "80000" }, { name: "โพธิ์เสด็จ", postalCode: "80000" }] },
      { name: "ทุ่งสง", subdistricts: [{ name: "ปากแพรก", postalCode: "80110" }, { name: "ชะมาย", postalCode: "80110" }] },
      { name: "ท่าศาลา", subdistricts: [{ name: "ท่าศาลา", postalCode: "80160" }] },
      { name: "สิชล", subdistricts: [{ name: "สิชล", postalCode: "80120" }, { name: "เสาเภา", postalCode: "80340" }] },
      { name: "ลานสกา", subdistricts: [{ name: "เขาแก้ว", postalCode: "80230" }, { name: "กำโลน", postalCode: "80230" }] },
    ],
  },
  {
    name: "นครสวรรค์",
    districts: [
      { name: "เมืองนครสวรรค์", subdistricts: [{ name: "ปากน้ำโพ", postalCode: "60000" }, { name: "นครสวรรค์ตก", postalCode: "60000" }, { name: "นครสวรรค์ออก", postalCode: "60000" }, { name: "วัดไทรย์", postalCode: "60000" }] },
      { name: "ลาดยาว", subdistricts: [{ name: "ลาดยาว", postalCode: "60150" }] },
      { name: "ชุมแสง", subdistricts: [{ name: "ชุมแสง", postalCode: "60120" }] },
      { name: "ตาคลี", subdistricts: [{ name: "ตาคลี", postalCode: "60140" }, { name: "ช่องแค", postalCode: "60260" }] },
      { name: "บรรพตพิสัย", subdistricts: [{ name: "ท่างิ้ว", postalCode: "60180" }] },
    ],
  },
  {
    name: "นนทบุรี",
    districts: [
      { name: "เมืองนนทบุรี", subdistricts: [{ name: "สวนใหญ่", postalCode: "11000" }, { name: "ตลาดขวัญ", postalCode: "11000" }, { name: "บางเขน", postalCode: "11000" }, { name: "บางกระสอ", postalCode: "11000" }, { name: "ท่าทราย", postalCode: "11000" }, { name: "บางกร่าง", postalCode: "11000" }, { name: "บางศรีเมือง", postalCode: "11000" }] },
      { name: "ปากเกร็ด", subdistricts: [{ name: "ปากเกร็ด", postalCode: "11120" }, { name: "บางพูด", postalCode: "11120" }, { name: "บ้านใหม่", postalCode: "11120" }, { name: "บางตลาด", postalCode: "11120" }, { name: "คลองเกลือ", postalCode: "11120" }, { name: "ท่าอิฐ", postalCode: "11120" }] },
      { name: "บางบัวทอง", subdistricts: [{ name: "โสนลอย", postalCode: "11110" }, { name: "บางบัวทอง", postalCode: "11110" }, { name: "บางรักพัฒนา", postalCode: "11110" }, { name: "พิมลราช", postalCode: "11110" }, { name: "บางคูรัด", postalCode: "11110" }] },
      { name: "บางใหญ่", subdistricts: [{ name: "บางใหญ่", postalCode: "11140" }, { name: "บางแม่นาง", postalCode: "11140" }, { name: "เสาธงหิน", postalCode: "11140" }] },
      { name: "บางกรวย", subdistricts: [{ name: "บางกรวย", postalCode: "11130" }, { name: "วัดชลอ", postalCode: "11130" }, { name: "มหาสวัสดิ์", postalCode: "11130" }] },
      { name: "ไทรน้อย", subdistricts: [{ name: "ไทรน้อย", postalCode: "11150" }, { name: "ราษฎร์นิยม", postalCode: "11150" }] },
    ],
  },
  {
    name: "นราธิวาส",
    districts: [
      { name: "เมืองนราธิวาส", subdistricts: [{ name: "บางนาค", postalCode: "96000" }, { name: "ลำภู", postalCode: "96000" }, { name: "โคกเคียน", postalCode: "96000" }] },
      { name: "สุไหงโก-ลก", subdistricts: [{ name: "สุไหงโก-ลก", postalCode: "96120" }] },
      { name: "ตากใบ", subdistricts: [{ name: "เจ๊ะเห", postalCode: "96110" }] },
      { name: "ระแงะ", subdistricts: [{ name: "ตันหยงมัส", postalCode: "96130" }] },
    ],
  },
  {
    name: "น่าน",
    districts: [
      { name: "เมืองน่าน", subdistricts: [{ name: "ในเวียง", postalCode: "55000" }, { name: "ผาสิงห์", postalCode: "55000" }, { name: "ดู่ใต้", postalCode: "55000" }] },
      { name: "ปัว", subdistricts: [{ name: "ปัว", postalCode: "55120" }, { name: "วรนคร", postalCode: "55120" }] },
      { name: "เวียงสา", subdistricts: [{ name: "กลางเวียง", postalCode: "55110" }] },
      { name: "ท่าวังผา", subdistricts: [{ name: "ท่าวังผา", postalCode: "55140" }] },
    ],
  },
  {
    name: "บึงกาฬ",
    districts: [
      { name: "เมืองบึงกาฬ", subdistricts: [{ name: "บึงกาฬ", postalCode: "38000" }, { name: "วิศิษฐ์", postalCode: "38000" }] },
      { name: "เซกา", subdistricts: [{ name: "เซกา", postalCode: "38150" }] },
      { name: "โซ่พิสัย", subdistricts: [{ name: "โซ่", postalCode: "38170" }] },
      { name: "ปากคาด", subdistricts: [{ name: "ปากคาด", postalCode: "38190" }] },
    ],
  },
  {
    name: "บุรีรัมย์",
    districts: [
      { name: "เมืองบุรีรัมย์", subdistricts: [{ name: "ในเมือง", postalCode: "31000" }, { name: "อิสาณ", postalCode: "31000" }, { name: "เสม็ด", postalCode: "31000" }] },
      { name: "นางรอง", subdistricts: [{ name: "นางรอง", postalCode: "31110" }, { name: "ถนนหัก", postalCode: "31110" }] },
      { name: "ประโคนชัย", subdistricts: [{ name: "ประโคนชัย", postalCode: "31140" }] },
      { name: "สตึก", subdistricts: [{ name: "สตึก", postalCode: "31150" }] },
      { name: "ลำปลายมาศ", subdistricts: [{ name: "ลำปลายมาศ", postalCode: "31130" }] },
    ],
  },
  {
    name: "ปทุมธานี",
    districts: [
      { name: "เมืองปทุมธานี", subdistricts: [{ name: "บางปรอก", postalCode: "12000" }, { name: "บ้านฉาง", postalCode: "12000" }, { name: "บางหลวง", postalCode: "12000" }, { name: "บางเดื่อ", postalCode: "12000" }] },
      { name: "คลองหลวง", subdistricts: [{ name: "คลองหนึ่ง", postalCode: "12120" }, { name: "คลองสอง", postalCode: "12120" }, { name: "คลองสาม", postalCode: "12120" }, { name: "คลองสี่", postalCode: "12120" }] },
      { name: "ธัญบุรี", subdistricts: [{ name: "ประชาธิปัตย์", postalCode: "12130" }, { name: "บึงยี่โถ", postalCode: "12130" }, { name: "รังสิต", postalCode: "12110" }] },
      { name: "ลำลูกกา", subdistricts: [{ name: "คูคต", postalCode: "12130" }, { name: "ลาดสวาย", postalCode: "12150" }, { name: "บึงคำพร้อย", postalCode: "12150" }, { name: "ลำลูกกา", postalCode: "12150" }] },
      { name: "ลาดหลุมแก้ว", subdistricts: [{ name: "ลาดหลุมแก้ว", postalCode: "12140" }, { name: "ระแหง", postalCode: "12140" }] },
      { name: "สามโคก", subdistricts: [{ name: "สามโคก", postalCode: "12160" }, { name: "บางเตย", postalCode: "12160" }] },
    ],
  },
  {
    name: "ประจวบคีรีขันธ์",
    districts: [
      { name: "เมืองประจวบคีรีขันธ์", subdistricts: [{ name: "ประจวบคีรีขันธ์", postalCode: "77000" }, { name: "เกาะหลัก", postalCode: "77000" }, { name: "อ่าวน้อย", postalCode: "77210" }] },
      { name: "หัวหิน", subdistricts: [{ name: "หัวหิน", postalCode: "77110" }, { name: "หนองแก", postalCode: "77110" }, { name: "หินเหล็กไฟ", postalCode: "77110" }] },
      { name: "ปราณบุรี", subdistricts: [{ name: "ปราณบุรี", postalCode: "77120" }, { name: "ปากน้ำปราณ", postalCode: "77220" }] },
      { name: "บางสะพาน", subdistricts: [{ name: "กำเนิดนพคุณ", postalCode: "77140" }] },
    ],
  },
  {
    name: "ปราจีนบุรี",
    districts: [
      { name: "เมืองปราจีนบุรี", subdistricts: [{ name: "หน้าเมือง", postalCode: "25000" }, { name: "รอบเมือง", postalCode: "25000" }, { name: "ดงพระราม", postalCode: "25000" }] },
      { name: "กบินทร์บุรี", subdistricts: [{ name: "กบินทร์", postalCode: "25110" }, { name: "เมืองเก่า", postalCode: "25240" }] },
      { name: "ศรีมหาโพธิ", subdistricts: [{ name: "ศรีมหาโพธิ", postalCode: "25140" }, { name: "ท่าตูม", postalCode: "25140" }] },
    ],
  },
  {
    name: "ปัตตานี",
    districts: [
      { name: "เมืองปัตตานี", subdistricts: [{ name: "สะบารัง", postalCode: "94000" }, { name: "อาเนาะรู", postalCode: "94000" }, { name: "รูสะมิแล", postalCode: "94000" }] },
      { name: "หนองจิก", subdistricts: [{ name: "ดอนรัก", postalCode: "94170" }] },
      { name: "สายบุรี", subdistricts: [{ name: "ตะลุบัน", postalCode: "94110" }] },
    ],
  },
  {
    name: "พระนครศรีอยุธยา",
    districts: [
      { name: "พระนครศรีอยุธยา", subdistricts: [{ name: "ประตูชัย", postalCode: "13000" }, { name: "หอรัตนไชย", postalCode: "13000" }, { name: "หัวรอ", postalCode: "13000" }, { name: "คลองสวนพลู", postalCode: "13000" }] },
      { name: "บางปะอิน", subdistricts: [{ name: "บ้านเลน", postalCode: "13160" }, { name: "เชียงรากน้อย", postalCode: "13180" }, { name: "คลองจิก", postalCode: "13160" }] },
      { name: "เสนา", subdistricts: [{ name: "เสนา", postalCode: "13110" }] },
      { name: "วังน้อย", subdistricts: [{ name: "ลำไทร", postalCode: "13170" }, { name: "วังน้อย", postalCode: "13170" }] },
      { name: "อุทัย", subdistricts: [{ name: "อุทัย", postalCode: "13210" }, { name: "คานหาม", postalCode: "13210" }] },
    ],
  },
  {
    name: "พะเยา",
    districts: [
      { name: "เมืองพะเยา", subdistricts: [{ name: "เวียง", postalCode: "56000" }, { name: "แม่ต๋ำ", postalCode: "56000" }, { name: "แม่กา", postalCode: "56000" }] },
      { name: "เชียงคำ", subdistricts: [{ name: "หย่วน", postalCode: "56110" }] },
      { name: "ดอกคำใต้", subdistricts: [{ name: "ดอกคำใต้", postalCode: "56120" }] },
    ],
  },
  {
    name: "พังงา",
    districts: [
      { name: "เมืองพังงา", subdistricts: [{ name: "ท้ายช้าง", postalCode: "82000" }, { name: "ถ้ำน้ำผุด", postalCode: "82000" }] },
      { name: "ตะกั่วป่า", subdistricts: [{ name: "ตะกั่วป่า", postalCode: "82110" }, { name: "คึกคัก", postalCode: "82190" }] },
      { name: "ท้ายเหมือง", subdistricts: [{ name: "ท้ายเหมือง", postalCode: "82120" }] },
    ],
  },
  {
    name: "พัทลุง",
    districts: [
      { name: "เมืองพัทลุง", subdistricts: [{ name: "คูหาสวรรค์", postalCode: "93000" }, { name: "เขาเจียก", postalCode: "93000" }] },
      { name: "ควนขนุน", subdistricts: [{ name: "ควนขนุน", postalCode: "93110" }] },
      { name: "เขาชัยสน", subdistricts: [{ name: "เขาชัยสน", postalCode: "93130" }] },
    ],
  },
  {
    name: "พิจิตร",
    districts: [
      { name: "เมืองพิจิตร", subdistricts: [{ name: "ในเมือง", postalCode: "66000" }, { name: "ท่าหลวง", postalCode: "66000" }] },
      { name: "ตะพานหิน", subdistricts: [{ name: "ตะพานหิน", postalCode: "66110" }] },
      { name: "บางมูลนาก", subdistricts: [{ name: "บางมูลนาก", postalCode: "66120" }] },
      { name: "โพธิ์ประทับช้าง", subdistricts: [{ name: "โพธิ์ประทับช้าง", postalCode: "66190" }] },
    ],
  },
  {
    name: "พิษณุโลก",
    districts: [
      { name: "เมืองพิษณุโลก", subdistricts: [{ name: "ในเมือง", postalCode: "65000" }, { name: "อรัญญิก", postalCode: "65000" }, { name: "พลายชุมพล", postalCode: "65000" }, { name: "หัวรอ", postalCode: "65000" }, { name: "ท่าทอง", postalCode: "65000" }] },
      { name: "วังทอง", subdistricts: [{ name: "วังทอง", postalCode: "65130" }] },
      { name: "นครไทย", subdistricts: [{ name: "นครไทย", postalCode: "65120" }] },
      { name: "บางระกำ", subdistricts: [{ name: "บางระกำ", postalCode: "65140" }] },
      { name: "วัดโบสถ์", subdistricts: [{ name: "วัดโบสถ์", postalCode: "65160" }] },
    ],
  },
  {
    name: "เพชรบุรี",
    districts: [
      { name: "เมืองเพชรบุรี", subdistricts: [{ name: "ท่าราบ", postalCode: "76000" }, { name: "คลองกระแชง", postalCode: "76000" }, { name: "บ้านหม้อ", postalCode: "76000" }] },
      { name: "ชะอำ", subdistricts: [{ name: "ชะอำ", postalCode: "76120" }, { name: "เขาใหญ่", postalCode: "76120" }] },
      { name: "ท่ายาง", subdistricts: [{ name: "ท่ายาง", postalCode: "76130" }] },
      { name: "บ้านแหลม", subdistricts: [{ name: "บ้านแหลม", postalCode: "76110" }] },
    ],
  },
  {
    name: "เพชรบูรณ์",
    districts: [
      { name: "เมืองเพชรบูรณ์", subdistricts: [{ name: "ในเมือง", postalCode: "67000" }, { name: "สะเดียง", postalCode: "67000" }, { name: "ชอนไพร", postalCode: "67000" }] },
      { name: "เขาค้อ", subdistricts: [{ name: "เขาค้อ", postalCode: "67270" }, { name: "แคมป์สน", postalCode: "67280" }] },
      { name: "หล่มสัก", subdistricts: [{ name: "หล่มสัก", postalCode: "67110" }] },
      { name: "วิเชียรบุรี", subdistricts: [{ name: "ท่าโรง", postalCode: "67130" }] },
    ],
  },
  {
    name: "แพร่",
    districts: [
      { name: "เมืองแพร่", subdistricts: [{ name: "ในเวียง", postalCode: "54000" }, { name: "นาจักร", postalCode: "54000" }, { name: "ทุ่งโฮ้ง", postalCode: "54000" }] },
      { name: "เด่นชัย", subdistricts: [{ name: "เด่นชัย", postalCode: "54110" }] },
      { name: "สูงเม่น", subdistricts: [{ name: "สูงเม่น", postalCode: "54130" }] },
    ],
  },
  {
    name: "ภูเก็ต",
    districts: [
      { name: "เมืองภูเก็ต", subdistricts: [{ name: "ตลาดใหญ่", postalCode: "83000" }, { name: "ตลาดเหนือ", postalCode: "83000" }, { name: "เกาะแก้ว", postalCode: "83000" }, { name: "รัษฎา", postalCode: "83000" }, { name: "วิชิต", postalCode: "83000" }, { name: "ฉลอง", postalCode: "83130" }, { name: "ราไวย์", postalCode: "83130" }, { name: "กะรน", postalCode: "83100" }] },
      { name: "กะทู้", subdistricts: [{ name: "กะทู้", postalCode: "83120" }, { name: "ป่าตอง", postalCode: "83150" }, { name: "กมลา", postalCode: "83150" }] },
      { name: "ถลาง", subdistricts: [{ name: "เทพกระษัตรี", postalCode: "83110" }, { name: "ศรีสุนทร", postalCode: "83110" }, { name: "เชิงทะเล", postalCode: "83110" }, { name: "ป่าคลอก", postalCode: "83110" }, { name: "ไม้ขาว", postalCode: "83110" }, { name: "สาคู", postalCode: "83110" }] },
    ],
  },
  {
    name: "มหาสารคาม",
    districts: [
      { name: "เมืองมหาสารคาม", subdistricts: [{ name: "ตลาด", postalCode: "44000" }, { name: "แวงน่าง", postalCode: "44000" }, { name: "เกิ้ง", postalCode: "44000" }] },
      { name: "กันทรวิชัย", subdistricts: [{ name: "โคกพระ", postalCode: "44150" }, { name: "ขามเรียง", postalCode: "44150" }, { name: "ท่าขอนยาง", postalCode: "44150" }] },
      { name: "โกสุมพิสัย", subdistricts: [{ name: "หัวขวาง", postalCode: "44140" }] },
      { name: "วาปีปทุม", subdistricts: [{ name: "หนองแสง", postalCode: "44120" }] },
      { name: "พยัคฆภูมิพิสัย", subdistricts: [{ name: "ปะหลาน", postalCode: "44110" }] },
    ],
  },
  {
    name: "มุกดาหาร",
    districts: [
      { name: "เมืองมุกดาหาร", subdistricts: [{ name: "มุกดาหาร", postalCode: "49000" }, { name: "ศรีบุญเรือง", postalCode: "49000" }] },
      { name: "นิคมคำสร้อย", subdistricts: [{ name: "นิคมคำสร้อย", postalCode: "49130" }] },
      { name: "ดอนตาล", subdistricts: [{ name: "ดอนตาล", postalCode: "49120" }] },
    ],
  },
  {
    name: "แม่ฮ่องสอน",
    districts: [
      { name: "เมืองแม่ฮ่องสอน", subdistricts: [{ name: "จองคำ", postalCode: "58000" }, { name: "ปางหมู", postalCode: "58000" }] },
      { name: "ปาย", subdistricts: [{ name: "เวียงใต้", postalCode: "58130" }, { name: "แม่นาเติง", postalCode: "58130" }] },
      { name: "แม่สะเรียง", subdistricts: [{ name: "แม่สะเรียง", postalCode: "58110" }] },
    ],
  },
  {
    name: "ยโสธร",
    districts: [
      { name: "เมืองยโสธร", subdistricts: [{ name: "ในเมือง", postalCode: "35000" }, { name: "สำราญ", postalCode: "35000" }] },
      { name: "กุดชุม", subdistricts: [{ name: "กุดชุม", postalCode: "35140" }] },
      { name: "คำเขื่อนแก้ว", subdistricts: [{ name: "ลุมพุก", postalCode: "35110" }] },
      { name: "เลิงนกทา", subdistricts: [{ name: "สามแยก", postalCode: "35120" }] },
    ],
  },
  {
    name: "ยะลา",
    districts: [
      { name: "เมืองยะลา", subdistricts: [{ name: "สะเตง", postalCode: "95000" }, { name: "สะเตงนอก", postalCode: "95000" }, { name: "เปาะเส้ง", postalCode: "95000" }] },
      { name: "เบตง", subdistricts: [{ name: "เบตง", postalCode: "95110" }, { name: "ยะรม", postalCode: "95110" }] },
      { name: "รามัน", subdistricts: [{ name: "กายูบอเกาะ", postalCode: "95140" }] },
    ],
  },
  {
    name: "ร้อยเอ็ด",
    districts: [
      { name: "เมืองร้อยเอ็ด", subdistricts: [{ name: "ในเมือง", postalCode: "45000" }, { name: "รอบเมือง", postalCode: "45000" }, { name: "เหนือเมือง", postalCode: "45000" }] },
      { name: "เสลภูมิ", subdistricts: [{ name: "กลาง", postalCode: "45120" }, { name: "ขวัญเมือง", postalCode: "45120" }] },
      { name: "โพนทอง", subdistricts: [{ name: "แวง", postalCode: "45110" }] },
      { name: "เกษตรวิสัย", subdistricts: [{ name: "เกษตรวิสัย", postalCode: "45150" }] },
      { name: "สุวรรณภูมิ", subdistricts: [{ name: "สระคู", postalCode: "45130" }] },
    ],
  },
  {
    name: "ระนอง",
    districts: [
      { name: "เมืองระนอง", subdistricts: [{ name: "เขานิเวศน์", postalCode: "85000" }, { name: "บางริ้น", postalCode: "85000" }, { name: "บางนอน", postalCode: "85000" }] },
      { name: "กะเปอร์", subdistricts: [{ name: "กะเปอร์", postalCode: "85120" }] },
      { name: "กระบุรี", subdistricts: [{ name: "น้ำจืด", postalCode: "85110" }] },
    ],
  },
  {
    name: "ระยอง",
    districts: [
      { name: "เมืองระยอง", subdistricts: [{ name: "ท่าประดู่", postalCode: "21000" }, { name: "ปากน้ำ", postalCode: "21000" }, { name: "เชิงเนิน", postalCode: "21000" }, { name: "เนินพระ", postalCode: "21000" }, { name: "มาบตาพุด", postalCode: "21150" }] },
      { name: "แกลง", subdistricts: [{ name: "ทางเกวียน", postalCode: "21110" }, { name: "กร่ำ", postalCode: "21190" }] },
      { name: "บ้านฉาง", subdistricts: [{ name: "บ้านฉาง", postalCode: "21130" }, { name: "พลา", postalCode: "21130" }] },
      { name: "ปลวกแดง", subdistricts: [{ name: "ปลวกแดง", postalCode: "21140" }, { name: "มาบยางพร", postalCode: "21140" }] },
    ],
  },
  {
    name: "ราชบุรี",
    districts: [
      { name: "เมืองราชบุรี", subdistricts: [{ name: "หน้าเมือง", postalCode: "70000" }, { name: "เจดีย์หัก", postalCode: "70000" }, { name: "ดอนตะโก", postalCode: "70000" }, { name: "โคกหม้อ", postalCode: "70000" }] },
      { name: "บ้านโป่ง", subdistricts: [{ name: "บ้านโป่ง", postalCode: "70110" }, { name: "ท่าผา", postalCode: "70110" }] },
      { name: "โพธาราม", subdistricts: [{ name: "โพธาราม", postalCode: "70120" }, { name: "คลองตาคต", postalCode: "70120" }] },
      { name: "ดำเนินสะดวก", subdistricts: [{ name: "ดำเนินสะดวก", postalCode: "70130" }] },
      { name: "สวนผึ้ง", subdistricts: [{ name: "สวนผึ้ง", postalCode: "70180" }] },
    ],
  },
  {
    name: "ลพบุรี",
    districts: [
      { name: "เมืองลพบุรี", subdistricts: [{ name: "ทะเลชุบศร", postalCode: "15000" }, { name: "ท่าหิน", postalCode: "15000" }, { name: "เขาสามยอด", postalCode: "15000" }, { name: "ท่าศาลา", postalCode: "15000" }] },
      { name: "พัฒนานิคม", subdistricts: [{ name: "พัฒนานิคม", postalCode: "15140" }] },
      { name: "บ้านหมี่", subdistricts: [{ name: "บ้านหมี่", postalCode: "15110" }] },
      { name: "ชัยบาดาล", subdistricts: [{ name: "ลำนารายณ์", postalCode: "15130" }] },
    ],
  },
  {
    name: "ลำปาง",
    districts: [
      { name: "เมืองลำปาง", subdistricts: [{ name: "เวียงเหนือ", postalCode: "52000" }, { name: "สบตุ๋ย", postalCode: "52100" }, { name: "หัวเวียง", postalCode: "52000" }, { name: "พระบาท", postalCode: "52000" }] },
      { name: "เกาะคา", subdistricts: [{ name: "เกาะคา", postalCode: "52130" }] },
      { name: "เถิน", subdistricts: [{ name: "ล้อมแรด", postalCode: "52160" }] },
      { name: "แม่เมาะ", subdistricts: [{ name: "แม่เมาะ", postalCode: "52220" }] },
    ],
  },
  {
    name: "ลำพูน",
    districts: [
      { name: "เมืองลำพูน", subdistricts: [{ name: "ในเมือง", postalCode: "51000" }, { name: "เวียงยอง", postalCode: "51000" }, { name: "อุโมงค์", postalCode: "51150" }, { name: "บ้านกลาง", postalCode: "51150" }] },
      { name: "ป่าซาง", subdistricts: [{ name: "ป่าซาง", postalCode: "51120" }] },
      { name: "บ้านโฮ่ง", subdistricts: [{ name: "บ้านโฮ่ง", postalCode: "51130" }] },
      { name: "ลี้", subdistricts: [{ name: "ลี้", postalCode: "51110" }] },
    ],
  },
  {
    name: "เลย",
    districts: [
      { name: "เมืองเลย", subdistricts: [{ name: "กุดป่อง", postalCode: "42000" }, { name: "เมือง", postalCode: "42000" }, { name: "นาอาน", postalCode: "42000" }] },
      { name: "เชียงคาน", subdistricts: [{ name: "เชียงคาน", postalCode: "42110" }] },
      { name: "วังสะพุง", subdistricts: [{ name: "วังสะพุง", postalCode: "42130" }] },
      { name: "ภูเรือ", subdistricts: [{ name: "ภูเรือ", postalCode: "42160" }] },
      { name: "ด่านซ้าย", subdistricts: [{ name: "ด่านซ้าย", postalCode: "42120" }] },
    ],
  },
  {
    name: "ศรีสะเกษ",
    districts: [
      { name: "เมืองศรีสะเกษ", subdistricts: [{ name: "เมืองเหนือ", postalCode: "33000" }, { name: "เมืองใต้", postalCode: "33000" }, { name: "หนองครก", postalCode: "33000" }] },
      { name: "กันทรลักษ์", subdistricts: [{ name: "น้ำอ้อม", postalCode: "33110" }, { name: "หนองหญ้าลาด", postalCode: "33110" }] },
      { name: "อุทุมพรพิสัย", subdistricts: [{ name: "กำแพง", postalCode: "33120" }] },
      { name: "ราษีไศล", subdistricts: [{ name: "เมืองคง", postalCode: "33160" }] },
      { name: "ขุขันธ์", subdistricts: [{ name: "ห้วยเหนือ", postalCode: "33140" }] },
    ],
  },
  {
    name: "สกลนคร",
    districts: [
      { name: "เมืองสกลนคร", subdistricts: [{ name: "ธาตุเชิงชุม", postalCode: "47000" }, { name: "ธาตุนาเวง", postalCode: "47000" }, { name: "ฮังโฮง", postalCode: "47000" }] },
      { name: "พังโคน", subdistricts: [{ name: "พังโคน", postalCode: "47160" }] },
      { name: "สว่างแดนดิน", subdistricts: [{ name: "สว่างแดนดิน", postalCode: "47110" }] },
      { name: "วานรนิวาส", subdistricts: [{ name: "วานรนิวาส", postalCode: "47120" }] },
      { name: "พรรณานิคม", subdistricts: [{ name: "พรรณา", postalCode: "47130" }] },
    ],
  },
  {
    name: "สงขลา",
    districts: [
      { name: "เมืองสงขลา", subdistricts: [{ name: "บ่อยาง", postalCode: "90000" }, { name: "เขารูปช้าง", postalCode: "90000" }, { name: "พะวง", postalCode: "90100" }] },
      { name: "หาดใหญ่", subdistricts: [{ name: "หาดใหญ่", postalCode: "90110" }, { name: "คอหงส์", postalCode: "90110" }, { name: "ควนลัง", postalCode: "90110" }, { name: "คลองแห", postalCode: "90110" }, { name: "บ้านพรุ", postalCode: "90250" }] },
      { name: "สะเดา", subdistricts: [{ name: "สะเดา", postalCode: "90120" }, { name: "ปาดังเบซาร์", postalCode: "90240" }, { name: "สำนักขาม", postalCode: "90320" }] },
      { name: "สิงหนคร", subdistricts: [{ name: "สทิงหม้อ", postalCode: "90280" }] },
      { name: "จะนะ", subdistricts: [{ name: "บ้านนา", postalCode: "90130" }] },
    ],
  },
  {
    name: "สตูล",
    districts: [
      { name: "เมืองสตูล", subdistricts: [{ name: "พิมาน", postalCode: "91000" }, { name: "คลองขุด", postalCode: "91000" }, { name: "ฉลุง", postalCode: "91140" }] },
      { name: "ละงู", subdistricts: [{ name: "ละงู", postalCode: "91110" }, { name: "ปากน้ำ", postalCode: "91110" }] },
      { name: "ควนโดน", subdistricts: [{ name: "ควนโดน", postalCode: "91160" }] },
    ],
  },
  {
    name: "สมุทรปราการ",
    districts: [
      { name: "เมืองสมุทรปราการ", subdistricts: [{ name: "ปากน้ำ", postalCode: "10270" }, { name: "สำโรงเหนือ", postalCode: "10270" }, { name: "บางเมือง", postalCode: "10270" }, { name: "แพรกษา", postalCode: "10280" }, { name: "ท้ายบ้าน", postalCode: "10280" }, { name: "บางปูใหม่", postalCode: "10280" }] },
      { name: "บางพลี", subdistricts: [{ name: "บางพลีใหญ่", postalCode: "10540" }, { name: "บางแก้ว", postalCode: "10540" }, { name: "ราชาเทวะ", postalCode: "10540" }, { name: "บางโฉลง", postalCode: "10540" }] },
      { name: "บางบ่อ", subdistricts: [{ name: "บางบ่อ", postalCode: "10560" }, { name: "คลองด่าน", postalCode: "10550" }] },
      { name: "พระประแดง", subdistricts: [{ name: "ตลาด", postalCode: "10130" }, { name: "บางพึ่ง", postalCode: "10130" }, { name: "บางจาก", postalCode: "10130" }, { name: "สำโรงใต้", postalCode: "10130" }] },
      { name: "พระสมุทรเจดีย์", subdistricts: [{ name: "แหลมฟ้าผ่า", postalCode: "10290" }, { name: "ปากคลองบางปลากด", postalCode: "10290" }] },
      { name: "บางเสาธง", subdistricts: [{ name: "บางเสาธง", postalCode: "10570" }, { name: "ศีรษะจรเข้น้อย", postalCode: "10570" }] },
    ],
  },
  {
    name: "สมุทรสงคราม",
    districts: [
      { name: "เมืองสมุทรสงคราม", subdistricts: [{ name: "แม่กลอง", postalCode: "75000" }, { name: "บางแก้ว", postalCode: "75000" }, { name: "ลาดใหญ่", postalCode: "75000" }] },
      { name: "อัมพวา", subdistricts: [{ name: "อัมพวา", postalCode: "75110" }, { name: "บางช้าง", postalCode: "75110" }] },
      { name: "บางคนที", subdistricts: [{ name: "กระดังงา", postalCode: "75120" }] },
    ],
  },
  {
    name: "สมุทรสาคร",
    districts: [
      { name: "เมืองสมุทรสาคร", subdistricts: [{ name: "มหาชัย", postalCode: "74000" }, { name: "ท่าฉลอม", postalCode: "74000" }, { name: "โกรกกราก", postalCode: "74000" }, { name: "คอกกระบือ", postalCode: "74000" }, { name: "บางกระเจ้า", postalCode: "74000" }] },
      { name: "กระทุ่มแบน", subdistricts: [{ name: "ตลาดกระทุ่มแบน", postalCode: "74110" }, { name: "อ้อมน้อย", postalCode: "74130" }, { name: "คลองมะเดื่อ", postalCode: "74110" }] },
      { name: "บ้านแพ้ว", subdistricts: [{ name: "บ้านแพ้ว", postalCode: "74120" }, { name: "หลักสาม", postalCode: "74120" }] },
    ],
  },
  {
    name: "สระแก้ว",
    districts: [
      { name: "เมืองสระแก้ว", subdistricts: [{ name: "สระแก้ว", postalCode: "27000" }, { name: "ท่าเกษม", postalCode: "27000" }, { name: "สระขวัญ", postalCode: "27000" }] },
      { name: "อรัญประเทศ", subdistricts: [{ name: "อรัญประเทศ", postalCode: "27120" }, { name: "บ้านใหม่หนองไทร", postalCode: "27120" }] },
      { name: "วัฒนานคร", subdistricts: [{ name: "วัฒนานคร", postalCode: "27160" }] },
      { name: "วังน้ำเย็น", subdistricts: [{ name: "วังน้ำเย็น", postalCode: "27210" }] },
    ],
  },
  {
    name: "สระบุรี",
    districts: [
      { name: "เมืองสระบุรี", subdistricts: [{ name: "ปากเพรียว", postalCode: "18000" }, { name: "ดาวเรือง", postalCode: "18000" }, { name: "ตะกุด", postalCode: "18000" }] },
      { name: "แก่งคอย", subdistricts: [{ name: "แก่งคอย", postalCode: "18110" }, { name: "ทับกวาง", postalCode: "18260" }] },
      { name: "พระพุทธบาท", subdistricts: [{ name: "พระพุทธบาท", postalCode: "18120" }, { name: "ขุนโขลน", postalCode: "18120" }] },
      { name: "หนองแค", subdistricts: [{ name: "หนองแค", postalCode: "18140" }, { name: "หินกอง", postalCode: "18140" }] },
      { name: "มวกเหล็ก", subdistricts: [{ name: "มวกเหล็ก", postalCode: "18180" }, { name: "มิตรภาพ", postalCode: "18180" }] },
    ],
  },
  {
    name: "สิงห์บุรี",
    districts: [
      { name: "เมืองสิงห์บุรี", subdistricts: [{ name: "บางพุทรา", postalCode: "16000" }, { name: "บางมัญ", postalCode: "16000" }, { name: "ต้นโพธิ์", postalCode: "16000" }] },
      { name: "อินทร์บุรี", subdistricts: [{ name: "อินทร์บุรี", postalCode: "16110" }] },
      { name: "บางระจัน", subdistricts: [{ name: "สิงห์", postalCode: "16130" }] },
      { name: "ค่ายบางระจัน", subdistricts: [{ name: "บางระจัน", postalCode: "16150" }] },
      { name: "พรหมบุรี", subdistricts: [{ name: "พรหมบุรี", postalCode: "16120" }] },
      { name: "ท่าช้าง", subdistricts: [{ name: "ถอนสมอ", postalCode: "16140" }] },
    ],
  },
  {
    name: "สุโขทัย",
    districts: [
      { name: "เมืองสุโขทัย", subdistricts: [{ name: "ธานี", postalCode: "64000" }, { name: "เมืองเก่า", postalCode: "64210" }, { name: "บ้านกล้วย", postalCode: "64000" }] },
      { name: "สวรรคโลก", subdistricts: [{ name: "เมืองสวรรคโลก", postalCode: "64110" }] },
      { name: "ศรีสัชนาลัย", subdistricts: [{ name: "หาดเสี้ยว", postalCode: "64130" }, { name: "ศรีสัชนาลัย", postalCode: "64190" }] },
      { name: "คีรีมาศ", subdistricts: [{ name: "โตนด", postalCode: "64160" }] },
    ],
  },
  {
    name: "สุพรรณบุรี",
    districts: [
      { name: "เมืองสุพรรณบุรี", subdistricts: [{ name: "ท่าพี่เลี้ยง", postalCode: "72000" }, { name: "รั้วใหญ่", postalCode: "72000" }, { name: "ท่าระหัด", postalCode: "72000" }, { name: "ไผ่ขวาง", postalCode: "72000" }] },
      { name: "สองพี่น้อง", subdistricts: [{ name: "สองพี่น้อง", postalCode: "72110" }, { name: "บางตาเถร", postalCode: "72110" }] },
      { name: "อู่ทอง", subdistricts: [{ name: "อู่ทอง", postalCode: "72160" }, { name: "จรเข้สามพัน", postalCode: "72160" }] },
      { name: "เดิมบางนางบวช", subdistricts: [{ name: "เขาพระ", postalCode: "72120" }, { name: "เดิมบาง", postalCode: "72120" }] },
      { name: "ศรีประจันต์", subdistricts: [{ name: "ศรีประจันต์", postalCode: "72140" }] },
      { name: "บางปลาม้า", subdistricts: [{ name: "บางปลาม้า", postalCode: "72150" }] },
      { name: "ด่านช้าง", subdistricts: [{ name: "ด่านช้าง", postalCode: "72180" }] },
    ],
  },
  {
    name: "สุราษฎร์ธานี",
    districts: [
      { name: "เมืองสุราษฎร์ธานี", subdistricts: [{ name: "ตลาด", postalCode: "84000" }, { name: "มะขามเตี้ย", postalCode: "84000" }, { name: "บางกุ้ง", postalCode: "84000" }, { name: "วัดประดู่", postalCode: "84000" }] },
      { name: "เกาะสมุย", subdistricts: [{ name: "อ่างทอง", postalCode: "84140" }, { name: "ลิปะน้อย", postalCode: "84140" }, { name: "บ่อผุด", postalCode: "84320" }, { name: "แม่น้ำ", postalCode: "84330" }, { name: "มะเร็ต", postalCode: "84310" }] },
      { name: "เกาะพะงัน", subdistricts: [{ name: "เกาะพะงัน", postalCode: "84280" }, { name: "บ้านใต้", postalCode: "84280" }, { name: "เกาะเต่า", postalCode: "84360" }] },
      { name: "พุนพิน", subdistricts: [{ name: "ท่าข้าม", postalCode: "84130" }] },
      { name: "กาญจนดิษฐ์", subdistricts: [{ name: "กาญจนดิษฐ์", postalCode: "84160" }] },
      { name: "บ้านนาสาร", subdistricts: [{ name: "นาสาร", postalCode: "84120" }] },
    ],
  },
  {
    name: "สุรินทร์",
    districts: [
      { name: "เมืองสุรินทร์", subdistricts: [{ name: "ในเมือง", postalCode: "32000" }, { name: "สลักได", postalCode: "32000" }, { name: "นอกเมือง", postalCode: "32000" }] },
      { name: "ปราสาท", subdistricts: [{ name: "กังแอน", postalCode: "32140" }] },
      { name: "ท่าตูม", subdistricts: [{ name: "ท่าตูม", postalCode: "32120" }] },
      { name: "สังขะ", subdistricts: [{ name: "สังขะ", postalCode: "32150" }] },
      { name: "รัตนบุรี", subdistricts: [{ name: "รัตนบุรี", postalCode: "32130" }] },
    ],
  },
  {
    name: "หนองคาย",
    districts: [
      { name: "เมืองหนองคาย", subdistricts: [{ name: "ในเมือง", postalCode: "43000" }, { name: "มีชัย", postalCode: "43000" }, { name: "โพธิ์ชัย", postalCode: "43000" }, { name: "หนองกอมเกาะ", postalCode: "43000" }] },
      { name: "ท่าบ่อ", subdistricts: [{ name: "ท่าบ่อ", postalCode: "43110" }] },
      { name: "โพนพิสัย", subdistricts: [{ name: "จุมพล", postalCode: "43120" }] },
      { name: "ศรีเชียงใหม่", subdistricts: [{ name: "พานพร้าว", postalCode: "43130" }] },
    ],
  },
  {
    name: "หนองบัวลำภู",
    districts: [
      { name: "เมืองหนองบัวลำภู", subdistricts: [{ name: "หนองบัว", postalCode: "39000" }, { name: "ลำภู", postalCode: "39000" }, { name: "โพธิ์ชัย", postalCode: "39000" }] },
      { name: "ศรีบุญเรือง", subdistricts: [{ name: "เมืองใหม่", postalCode: "39180" }] },
      { name: "นากลาง", subdistricts: [{ name: "นากลาง", postalCode: "39170" }] },
      { name: "โนนสัง", subdistricts: [{ name: "โนนสัง", postalCode: "39140" }] },
    ],
  },
  {
    name: "อ่างทอง",
    districts: [
      { name: "เมืองอ่างทอง", subdistricts: [{ name: "ตลาดหลวง", postalCode: "14000" }, { name: "บางแก้ว", postalCode: "14000" }, { name: "ศาลาแดง", postalCode: "14000" }] },
      { name: "วิเศษชัยชาญ", subdistricts: [{ name: "ศาลเจ้าโรงทอง", postalCode: "14110" }, { name: "ไผ่จำศีล", postalCode: "14110" }] },
      { name: "โพธิ์ทอง", subdistricts: [{ name: "อ่างแก้ว", postalCode: "14120" }] },
      { name: "ป่าโมก", subdistricts: [{ name: "ป่าโมก", postalCode: "14130" }, { name: "บางปลากด", postalCode: "14130" }] },
      { name: "ไชโย", subdistricts: [{ name: "จรเข้ร้อง", postalCode: "14160" }] },
      { name: "แสวงหา", subdistricts: [{ name: "แสวงหา", postalCode: "14150" }] },
      { name: "สามโก้", subdistricts: [{ name: "สามโก้", postalCode: "14160" }] },
    ],
  },
  {
    name: "อำนาจเจริญ",
    districts: [
      { name: "เมืองอำนาจเจริญ", subdistricts: [{ name: "บุ่ง", postalCode: "37000" }, { name: "โนนหนามแท่ง", postalCode: "37000" }] },
      { name: "เสนางคนิคม", subdistricts: [{ name: "เสนางคนิคม", postalCode: "37290" }] },
      { name: "หัวตะพาน", subdistricts: [{ name: "หัวตะพาน", postalCode: "37240" }] },
      { name: "ลืออำนาจ", subdistricts: [{ name: "อำนาจ", postalCode: "37180" }] },
      { name: "พนา", subdistricts: [{ name: "พนา", postalCode: "37180" }] },
    ],
  },
  {
    name: "อุดรธานี",
    districts: [
      { name: "เมืองอุดรธานี", subdistricts: [{ name: "หมากแข้ง", postalCode: "41000" }, { name: "หนองบัว", postalCode: "41000" }, { name: "บ้านเลื่อม", postalCode: "41000" }, { name: "บ้านจั่น", postalCode: "41000" }, { name: "นาดี", postalCode: "41000" }] },
      { name: "กุมภวาปี", subdistricts: [{ name: "กุมภวาปี", postalCode: "41110" }, { name: "พันดอน", postalCode: "41110" }] },
      { name: "บ้านดุง", subdistricts: [{ name: "ศรีสุทโธ", postalCode: "41190" }, { name: "บ้านดุง", postalCode: "41190" }] },
      { name: "หนองหาน", subdistricts: [{ name: "หนองหาน", postalCode: "41130" }] },
      { name: "เพ็ญ", subdistricts: [{ name: "เพ็ญ", postalCode: "41150" }] },
      { name: "โนนสะอาด", subdistricts: [{ name: "โนนสะอาด", postalCode: "41240" }] },
    ],
  },
  {
    name: "อุตรดิตถ์",
    districts: [
      { name: "เมืองอุตรดิตถ์", subdistricts: [{ name: "ท่าอิฐ", postalCode: "53000" }, { name: "ท่าเสา", postalCode: "53000" }, { name: "บ้านเกาะ", postalCode: "53000" }] },
      { name: "ลับแล", subdistricts: [{ name: "ศรีพนมมาศ", postalCode: "53130" }, { name: "หัวดง", postalCode: "53130" }] },
      { name: "พิชัย", subdistricts: [{ name: "ในเมือง", postalCode: "53120" }] },
      { name: "ตรอน", subdistricts: [{ name: "วังแดง", postalCode: "53140" }] },
    ],
  },
  {
    name: "อุทัยธานี",
    districts: [
      { name: "เมืองอุทัยธานี", subdistricts: [{ name: "อุทัยใหม่", postalCode: "61000" }, { name: "น้ำซึม", postalCode: "61000" }, { name: "สะแกกรัง", postalCode: "61000" }] },
      { name: "หนองฉาง", subdistricts: [{ name: "หนองฉาง", postalCode: "61110" }] },
      { name: "ทัพทัน", subdistricts: [{ name: "ทัพทัน", postalCode: "61120" }] },
      { name: "สว่างอารมณ์", subdistricts: [{ name: "สว่างอารมณ์", postalCode: "61150" }] },
      { name: "บ้านไร่", subdistricts: [{ name: "บ้านไร่", postalCode: "61140" }] },
    ],
  },
  {
    name: "อุบลราชธานี",
    districts: [
      { name: "เมืองอุบลราชธานี", subdistricts: [{ name: "ในเมือง", postalCode: "34000" }, { name: "อุบล", postalCode: "34000" }, { name: "ขามใหญ่", postalCode: "34000" }, { name: "แจระแม", postalCode: "34000" }, { name: "หนองขอน", postalCode: "34000" }] },
      { name: "วารินชำราบ", subdistricts: [{ name: "วารินชำราบ", postalCode: "34190" }, { name: "แสนสุข", postalCode: "34190" }, { name: "คำน้ำแซบ", postalCode: "34190" }] },
      { name: "เดชอุดม", subdistricts: [{ name: "เมืองเดช", postalCode: "34160" }] },
      { name: "พิบูลมังสาหาร", subdistricts: [{ name: "พิบูล", postalCode: "34110" }] },
      { name: "ตระการพืชผล", subdistricts: [{ name: "ขุหลุ", postalCode: "34130" }] },
      { name: "เขมราฐ", subdistricts: [{ name: "เขมราฐ", postalCode: "34170" }] },
      { name: "สิรินธร", subdistricts: [{ name: "นิคมสร้างตนเองลำโดมน้อย", postalCode: "34350" }] },
    ],
  },
];

export const ALL_77_PROVINCES: string[] = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พะเยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "แม่ฮ่องสอน",
  "ยโสธร",
  "ยะลา",
  "ร้อยเอ็ด",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสงคราม",
  "สมุทรสาคร",
  "สระแก้ว",
  "สระบุรี",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
];

export function getProvinces(): string[] {
  return ALL_77_PROVINCES;
}

export function getDistricts(provinceName: string): string[] {
  const prov = THAI_PROVINCES.find((p) => p.name === provinceName);
  if (!prov) return [];
  return prov.districts.map((d) => d.name);
}

export function getSubdistricts(provinceName: string, districtName: string): string[] {
  const prov = THAI_PROVINCES.find((p) => p.name === provinceName);
  if (!prov) return [];
  const dist = prov.districts.find((d) => d.name === districtName);
  if (!dist) return [];
  return dist.subdistricts.map((s) => s.name);
}

export function getPostalCode(provinceName: string, districtName: string, subdistrictName: string): string {
  const prov = THAI_PROVINCES.find((p) => p.name === provinceName);
  if (!prov) return "";
  const dist = prov.districts.find((d) => d.name === districtName);
  if (!dist) return "";
  const sub = dist.subdistricts.find((s) => s.name === subdistrictName);
  return sub ? sub.postalCode : "";
}
