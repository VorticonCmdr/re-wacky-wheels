// Ghidra pre-script for tools/ghidra/import.sh. The program is created from analysis/ww/obj1.bin
// by the raw BinaryLoader at obj1's LE base; this script renames that block, adds the remaining
// objects at their LE-declared bases, applies the LE fixups as relocations (so references resolve
// in the listing) and marks the entry point. Everything it produces is derived: cite the
// object-relative pre-fixup offset (npm run cite), never a Ghidra address alone.
//@category WackyWheels
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.reloc.Relocation;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public class ImportWwObjects extends GhidraScript {
  @Override
  public void run() throws Exception {
    String[] args = getScriptArgs();
    Path dir = Path.of(args.length > 0 ? args[0] : "analysis/ww");
    JsonObject layout = JsonParser.parseString(Files.readString(dir.resolve("layout.json"))).getAsJsonObject();
    Memory mem = currentProgram.getMemory();
    long[] bases = new long[16];
    for (JsonElement e : layout.getAsJsonArray("objects")) {
      JsonObject o = e.getAsJsonObject();
      int n = o.get("number").getAsInt();
      long base = o.get("base").getAsLong();
      bases[n] = base;
      Address start = toAddr(base);
      MemoryBlock block = mem.getBlock(start);
      if (block == null) {
        byte[] data = Files.readAllBytes(dir.resolve("obj" + n + ".bin"));
        block = mem.createInitializedBlock("obj" + n, start, new ByteArrayInputStream(data), data.length, monitor, false);
      } else {
        block.setName("obj" + n);
      }
      // LE object flags (spec lead): 0x1 readable, 0x2 writable, 0x4 executable.
      long flags = o.get("flags").getAsLong();
      block.setRead((flags & 1) != 0);
      block.setWrite((flags & 2) != 0);
      block.setExecute((flags & 4) != 0);
    }
    JsonArray fixups = JsonParser.parseString(Files.readString(dir.resolve("fixups.json"))).getAsJsonArray();
    int applied = 0, recorded = 0;
    for (JsonElement e : fixups) {
      JsonObject f = e.getAsJsonObject();
      Address site = toAddr(bases[f.get("object").getAsInt()] + f.get("offset").getAsLong());
      int type = f.get("type").getAsInt();
      long value = f.get("value").getAsLong();
      if (type == 7) { // 32-bit offset: write the flat target address
        byte[] orig = new byte[4];
        mem.getBytes(site, orig);
        mem.setInt(site, (int) value);
        currentProgram.getRelocationTable().add(site, Relocation.Status.APPLIED, type, new long[] { value }, orig, null);
        applied++;
      } else { // 16-bit selector: assigned by DOS/4G at run time, so only recorded
        currentProgram.getRelocationTable().add(site, Relocation.Status.SKIPPED, type, new long[] { value }, 2, null);
        recorded++;
      }
    }
    JsonObject eip = layout.getAsJsonObject("eip");
    Address entry = toAddr(bases[eip.get("object").getAsInt()] + eip.get("offset").getAsLong());
    addEntryPoint(entry);
    createLabel(entry, "le_entry", true);
    println("ImportWwObjects: " + applied + " fixups applied, " + recorded + " selector fixups recorded, entry " + entry);
  }
}
