// Read-only check of the imported program against analysis/ww (run by tools/ghidra/verify.sh).
// Exits the script with an error unless:
//  - blocks obj1 and obj2 exist at the LE-declared bases with the declared sizes and permissions;
//  - every byte outside a 32-bit fixup site equals the pre-fixup dump;
//  - every 32-bit fixup site holds the flat target address (base of target object + target offset);
//  - the entry label sits at obj1+0x311a8.
// It is a check of the import tooling, not evidence about the game (see docs/evidence.md).
//@category WackyWheels
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.mem.MemoryBlock;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.BitSet;

public class VerifyWwImport extends GhidraScript {
  @Override
  public void run() throws Exception {
    Path dir = Path.of(getScriptArgs().length > 0 ? getScriptArgs()[0] : "analysis/ww");
    JsonObject layout = JsonParser.parseString(Files.readString(dir.resolve("layout.json"))).getAsJsonObject();
    Memory mem = currentProgram.getMemory();
    long[] bases = new long[16];
    byte[][] dumps = new byte[16][];
    BitSet[] sites = new BitSet[16];
    for (JsonElement e : layout.getAsJsonArray("objects")) {
      JsonObject o = e.getAsJsonObject();
      int n = o.get("number").getAsInt();
      bases[n] = o.get("base").getAsLong();
      dumps[n] = Files.readAllBytes(dir.resolve("obj" + n + ".bin"));
      sites[n] = new BitSet();
      MemoryBlock b = mem.getBlock("obj" + n);
      if (b == null) throw new RuntimeException("missing block obj" + n);
      if (b.getStart().getOffset() != bases[n]) throw new RuntimeException("obj" + n + " starts at " + b.getStart());
      if (b.getSize() != o.get("virtualSize").getAsLong()) throw new RuntimeException("obj" + n + " size " + b.getSize());
      long flags = o.get("flags").getAsLong();
      if (b.isRead() != ((flags & 1) != 0) || b.isWrite() != ((flags & 2) != 0) || b.isExecute() != ((flags & 4) != 0))
        throw new RuntimeException("obj" + n + " permissions differ from LE flags " + Long.toHexString(flags));
      println("block obj" + n + " " + b.getStart() + " size " + b.getSize() + " " + (b.isRead() ? "r" : "-") + (b.isWrite() ? "w" : "-") + (b.isExecute() ? "x" : "-"));
    }
    JsonArray fixups = JsonParser.parseString(Files.readString(dir.resolve("fixups.json"))).getAsJsonArray();
    int checked = 0, wrong = 0;
    for (JsonElement e : fixups) {
      JsonObject f = e.getAsJsonObject();
      if (f.get("type").getAsInt() != 7) continue;
      int n = f.get("object").getAsInt();
      long off = f.get("offset").getAsLong();
      for (int k = 0; k < 4; k++) if (off + k >= 0 && off + k < dumps[n].length) sites[n].set((int) off + k);
      if (off < 0 || off + 4 > dumps[n].length) continue; // straddles a page edge into an object edge; none expected
      int got = mem.getInt(toAddr(bases[n] + off));
      if (got != (int) f.get("value").getAsLong()) { wrong++; if (wrong < 5) println("fixup mismatch obj" + n + "+" + Long.toHexString(off)); }
      checked++;
    }
    if (wrong > 0) throw new RuntimeException(wrong + " fixup sites differ");
    long diffs = 0;
    for (int n = 1; n < 16; n++) {
      if (dumps[n] == null) continue;
      byte[] live = new byte[dumps[n].length];
      mem.getBytes(toAddr(bases[n]), live);
      for (int i = 0; i < live.length; i++) if (!sites[n].get(i) && live[i] != dumps[n][i]) diffs++;
    }
    if (diffs > 0) throw new RuntimeException(diffs + " non-fixup bytes differ from the dump");
    Address entry = toAddr(bases[1] + layout.getAsJsonObject("eip").get("offset").getAsLong());
    boolean labelled = false;
    for (ghidra.program.model.symbol.Symbol sym : currentProgram.getSymbolTable().getSymbols(entry)) if (sym.getName().equals("le_entry")) labelled = true;
    if (!labelled) throw new RuntimeException("no le_entry label at " + entry);
    println("VerifyWwImport OK: " + checked + " fixup sites hold their targets, all other bytes match the dump, le_entry at " + entry);
  }
}
