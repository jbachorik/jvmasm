/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package net.java.jvmasm;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;

/**
 *
 * @author jbachorik
 */
public class Main {

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) throws Exception {
        ScriptEngine e = new ScriptEngineManager().getEngineByExtension("js");

        InputStream asmStream = Main.class.getResourceAsStream("asm/jvmasm.js");
        InputStream testStream = Main.class.getResourceAsStream("test/asmcode.js");
        e.eval(new InputStreamReader(asmStream));

        byte[] ret = (byte[])e.eval(new InputStreamReader(testStream));

        Path f = java.nio.file.FileSystems.getDefault().getPath("/tmp/Shoot.class");
        Files.write(f, ret, StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING);

        URLClassLoader cl = new URLClassLoader(new URL[]{f.getParent().toUri().toURL()});
        Class clz = cl.loadClass("Shoot");

        Object i = clz.newInstance();

        Method m = clz.getMethod("damethod");
        String s = (String)m.invoke(i);

        System.err.println(s);
    }

    private static void test() {
        check(-3);
    }

    private static void check(long i) {
        System.err.println(i);
    }
}
